package com.groupmart.service;

import java.math.BigDecimal;
import java.util.List;

import com.groupmart.dto.auction.AuctionTierDto;
import com.groupmart.entity.AuctionPricingRule;
import com.groupmart.entity.GroupBuyingAuction;

/**
 * The auction pricing engine.
 * <p>
 * This is the <b>only</b> place a Group Buying Auction's final unit price is ever produced. It is a
 * pure, deterministic function of the auction's stored configuration (starting price, pricing rule,
 * tier ladder or discount percentage, and the seller's minimum price) plus the collective quantity
 * the auction actually reached. It contains no randomness, no learning and no pricing heuristics,
 * and it never reads a CWP wholesale price.
 * <p>
 * The value it returns for a live auction is only a projection for display; the price that customers
 * are actually charged is the value recomputed and locked by the finalization service.
 */
public interface AuctionPricingService {

    /**
     * The unit price the given collective quantity clears at under this auction's configured rule,
     * after clamping to the seller's minimum unit price when one is set.
     */
    BigDecimal calculateUnitPrice(GroupBuyingAuction auction, int collectiveQuantity);

    /** Applies a configured pricing rule to a starting price, without the seller floor. */
    BigDecimal calculateFrom(AuctionPricingRule rule, BigDecimal startingPrice, BigDecimal discountPercent,
                             List<AuctionTierDto> tiers, int collectiveQuantity);

    /**
     * Validates a rule configuration and returns the unit price the given collective quantity would
     * clear at, so a seller gets immediate feedback while configuring the ladder.
     *
     * @throws IllegalArgumentException when the configuration is inconsistent
     */
    BigDecimal validateAndProject(AuctionPricingRule rule, BigDecimal startingPrice, BigDecimal discountPercent,
                                  List<AuctionTierDto> tiers, int collectiveQuantity, BigDecimal minimumSellerUnitPrice);
}
