package com.groupmart.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.groupmart.dto.auction.AuctionTierDto;
import com.groupmart.entity.AuctionPricingRule;
import com.groupmart.entity.GroupBuyingAuction;
import com.groupmart.entity.GroupBuyingAuctionTier;
import com.groupmart.repository.GroupBuyingAuctionTierRepository;
import com.groupmart.service.AuctionPricingService;

/**
 * Deterministic collective-pricing engine for Group Buying Auctions.
 * <p>
 * Rules:
 * <ul>
 *   <li>{@link AuctionPricingRule#COLLECTIVE_QUANTITY_TIERS} - the highest tier whose minimum
 *       collective quantity is reached wins; if no tier is reached the starting price applies. This
 *       is the "more collective quantity, better unit price" ladder.</li>
 *   <li>{@link AuctionPricingRule#COLLECTIVE_QUANTITY_DISCOUNT} - a configured percentage off the
 *       starting price.</li>
 * </ul>
 * In both cases the result is finally clamped up to the seller's minimum acceptable unit price, so
 * the auction can never settle below what the seller configured, and never above the starting price.
 * <p>
 * Independent of CWP: the CWP wholesale price is neither read nor used here.
 */
@Service
@RequiredArgsConstructor
public class AuctionPricingServiceImpl implements AuctionPricingService {

    private static final int MONEY_SCALE = 2;
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final GroupBuyingAuctionTierRepository tierRepository;

    @Override
    public BigDecimal calculateUnitPrice(GroupBuyingAuction auction, int collectiveQuantity) {
        BigDecimal price = applyRule(auction.getPricingRule(), auction.getStartingPrice(),
                auction.getDiscountPercent(), tiersOf(auction), collectiveQuantity);

        BigDecimal floor = auction.getMinimumSellerUnitPrice();
        if (floor != null && floor.signum() > 0 && price.compareTo(floor) < 0) {
            price = floor;
        }
        return money(price);
    }

    @Override
    public BigDecimal calculateFrom(AuctionPricingRule rule, BigDecimal startingPrice, BigDecimal discountPercent,
                                    List<AuctionTierDto> tiers, int collectiveQuantity) {
        return money(applyRule(rule, startingPrice, discountPercent, tiers, collectiveQuantity));
    }

    @Override
    public BigDecimal validateAndProject(AuctionPricingRule rule, BigDecimal startingPrice, BigDecimal discountPercent,
                                         List<AuctionTierDto> tiers, int collectiveQuantity,
                                         BigDecimal minimumSellerUnitPrice) {
        validateConfiguration(rule, startingPrice, discountPercent, tiers, minimumSellerUnitPrice);
        BigDecimal price = applyRule(rule, startingPrice, discountPercent, tiers, collectiveQuantity);
        if (minimumSellerUnitPrice != null && minimumSellerUnitPrice.signum() > 0
                && price.compareTo(minimumSellerUnitPrice) < 0) {
            price = minimumSellerUnitPrice;
        }
        return money(price);
    }

    // ----- Rules -------------------------------------------------------------------------------

    private BigDecimal applyRule(AuctionPricingRule rule, BigDecimal startingPrice, BigDecimal discountPercent,
                                 List<AuctionTierDto> tiers, int collectiveQuantity) {
        if (rule == null) {
            throw new IllegalArgumentException("An auction needs a pricing rule");
        }
        return switch (rule) {
            case COLLECTIVE_QUANTITY_TIERS -> tierPrice(tiers, startingPrice, collectiveQuantity);
            case COLLECTIVE_QUANTITY_DISCOUNT -> discountPrice(startingPrice, discountPercent);
        };
    }

    /** The highest reached tier wins; no reached tier means the starting price stands. */
    private BigDecimal tierPrice(List<AuctionTierDto> tiers, BigDecimal startingPrice, int collectiveQuantity) {
        if (tiers == null || tiers.isEmpty()) {
            return startingPrice;
        }
        return tiers.stream()
                .filter(tier -> tier.getMinQuantity() <= collectiveQuantity)
                .max(Comparator.comparing(AuctionTierDto::getMinQuantity))
                .map(AuctionTierDto::getUnitPrice)
                .orElse(startingPrice);
    }

    private BigDecimal discountPrice(BigDecimal startingPrice, BigDecimal discountPercent) {
        if (discountPercent == null) {
            throw new IllegalArgumentException("This auction needs a discount percentage");
        }
        BigDecimal factor = BigDecimal.ONE.subtract(discountPercent.divide(HUNDRED, 6, RoundingMode.HALF_UP));
        return startingPrice.multiply(factor);
    }

    // ----- Configuration checks ----------------------------------------------------------------

    private void validateConfiguration(AuctionPricingRule rule, BigDecimal startingPrice, BigDecimal discountPercent,
                                       List<AuctionTierDto> tiers, BigDecimal minimumSellerUnitPrice) {
        if (rule == null) {
            throw new IllegalArgumentException("A pricing rule is required");
        }
        if (startingPrice == null || startingPrice.signum() <= 0) {
            throw new IllegalArgumentException("The starting price must be greater than zero");
        }
        if (minimumSellerUnitPrice != null) {
            if (minimumSellerUnitPrice.signum() <= 0) {
                throw new IllegalArgumentException("The minimum seller unit price must be greater than zero");
            }
            if (minimumSellerUnitPrice.compareTo(startingPrice) >= 0) {
                throw new IllegalArgumentException("The minimum seller unit price must be lower than the starting price");
            }
        }

        switch (rule) {
            case COLLECTIVE_QUANTITY_TIERS -> {
                if (tiers == null || tiers.isEmpty()) {
                    throw new IllegalArgumentException("A quantity-tier auction needs at least one price tier");
                }
                int previousMin = 0;
                BigDecimal previousPrice = null;
                for (AuctionTierDto tier : tiers) {
                    if (tier.getMinQuantity() < 1) {
                        throw new IllegalArgumentException("Every price tier needs a minimum quantity of at least 1");
                    }
                    if (tier.getUnitPrice() == null || tier.getUnitPrice().signum() <= 0) {
                        throw new IllegalArgumentException("Every price tier needs a unit price greater than zero");
                    }
                    if (tier.getMinQuantity() <= previousMin) {
                        throw new IllegalArgumentException(
                                "Price tiers must be listed once each, in ascending minimum quantity order");
                    }
                    if (tier.getUnitPrice().compareTo(startingPrice) >= 0) {
                        throw new IllegalArgumentException(
                                "A price tier must be lower than the starting price of " + startingPrice);
                    }
                    if (previousPrice != null && tier.getUnitPrice().compareTo(previousPrice) >= 0) {
                        throw new IllegalArgumentException(
                                "Each price tier must be cheaper than the one above it, so more collective units "
                                        + "always means a better unit price");
                    }
                    previousMin = tier.getMinQuantity();
                    previousPrice = tier.getUnitPrice();
                }
            }
            case COLLECTIVE_QUANTITY_DISCOUNT -> {
                if (discountPercent == null) {
                    throw new IllegalArgumentException("A percentage-discount auction needs a discount percentage");
                }
                if (discountPercent.signum() <= 0 || discountPercent.compareTo(HUNDRED) >= 0) {
                    throw new IllegalArgumentException("The discount percentage must be above 0 and below 100");
                }
            }
        }
    }

    // ----- Helpers -----------------------------------------------------------------------------

    private List<AuctionTierDto> tiersOf(GroupBuyingAuction auction) {
        if (auction.getId() == null) {
            return List.of();
        }
        return tierRepository.findByAuctionIdOrderByMinQuantityAsc(auction.getId()).stream()
                .map(AuctionPricingServiceImpl::toTierDto)
                .toList();
    }

    static AuctionTierDto toTierDto(GroupBuyingAuctionTier tier) {
        return AuctionTierDto.builder()
                .id(tier.getId())
                .minQuantity(tier.getMinQuantity())
                .unitPrice(tier.getUnitPrice())
                .build();
    }

    private static BigDecimal money(BigDecimal value) {
        return value.setScale(MONEY_SCALE, RoundingMode.HALF_UP);
    }
}
