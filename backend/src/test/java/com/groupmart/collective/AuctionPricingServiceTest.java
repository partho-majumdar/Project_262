package com.groupmart.collective;

import java.math.BigDecimal;
import java.util.List;

import com.groupmart.dto.auction.AuctionParticipationRequest;
import com.groupmart.dto.auction.AuctionTierDto;
import com.groupmart.entity.AuctionPricingRule;
import com.groupmart.service.impl.AuctionPricingServiceImpl;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The auction pricing engine on its own. It is the only component allowed to produce a final unit
 * price, so the rules, the seller floor and the configuration guards are all pinned here.
 * <p>
 * A plain unit test: {@code calculateFrom} is a pure function of the configured rule, so it never
 * touches the tier repository.
 */
class AuctionPricingServiceTest {

    private final AuctionPricingServiceImpl pricingService = new AuctionPricingServiceImpl(null);

    private static AuctionTierDto tier(int minQuantity, String price) {
        return AuctionTierDto.builder().minQuantity(minQuantity).unitPrice(new BigDecimal(price)).build();
    }

    @Test
    void higherCollectiveQuantityClearsAtABetterUnitPrice() {
        List<AuctionTierDto> tiers = List.of(tier(1, "1000.00"), tier(5, "950.00"), tier(10, "900.00"));
        BigDecimal start = new BigDecimal("1000.00");

        // Below the first rung the starting price stands.
        assertEquals(0, pricingService.calculateFrom(AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS,
                start, null, tiers, 1).compareTo(new BigDecimal("1000.00")));
        // 4 units is still in the 1-4 band.
        assertEquals(0, pricingService.calculateFrom(AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS,
                start, null, tiers, 4).compareTo(new BigDecimal("1000.00")));
        // 5-9 units reaches the second rung.
        assertEquals(0, pricingService.calculateFrom(AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS,
                start, null, tiers, 5).compareTo(new BigDecimal("950.00")));
        assertEquals(0, pricingService.calculateFrom(AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS,
                start, null, tiers, 9).compareTo(new BigDecimal("950.00")));
        // 10+ units reaches the third.
        assertEquals(0, pricingService.calculateFrom(AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS,
                start, null, tiers, 10).compareTo(new BigDecimal("900.00")));
        assertEquals(0, pricingService.calculateFrom(AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS,
                start, null, tiers, 250).compareTo(new BigDecimal("900.00")));
    }

    @Test
    void aPercentageDiscountRuleAppliesTheConfiguredDiscount() {
        BigDecimal start = new BigDecimal("1000.00");
        assertEquals(0, pricingService.calculateFrom(AuctionPricingRule.COLLECTIVE_QUANTITY_DISCOUNT,
                start, new BigDecimal("12.50"), List.of(), 1).compareTo(new BigDecimal("875.00")));
        assertEquals(0, pricingService.calculateFrom(AuctionPricingRule.COLLECTIVE_QUANTITY_DISCOUNT,
                start, new BigDecimal("10"), List.of(), 99).compareTo(new BigDecimal("900.00")));
    }

    @Test
    void theSellerFloorStopsThePriceFallingBelowWhatTheyConfigured() {
        List<AuctionTierDto> tiers = List.of(tier(1, "990.00"), tier(10, "700.00"));
        // The ladder would settle at 700, but the seller will not go below 850.
        assertEquals(0, pricingService.validateAndProject(AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS,
                new BigDecimal("1000.00"), null, tiers, 10, new BigDecimal("850.00"))
                .compareTo(new BigDecimal("850.00")));
        // A floor below the ladder leaves the ladder's price alone.
        assertEquals(0, pricingService.validateAndProject(AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS,
                new BigDecimal("1000.00"), null, tiers, 10, new BigDecimal("500.00"))
                .compareTo(new BigDecimal("700.00")));
    }

    @Test
    void anInconsistentLadderIsRejectedWithAClearMessage() {
        BigDecimal start = new BigDecimal("1000.00");

        assertThrows(IllegalArgumentException.class, () -> pricingService.validateAndProject(
                AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS, start, null, List.of(), 5, null),
                "A tiered auction with no tiers is invalid");

        // A well-formed ladder is accepted and projects a price.
        assertEquals(0, pricingService.validateAndProject(AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS,
                start, null, List.of(tier(5, "900.00"), tier(10, "800.00")), 12, null)
                .compareTo(new BigDecimal("800.00")));

        // Each tier must be strictly cheaper than the one above it.
        assertThrows(IllegalArgumentException.class, () -> pricingService.validateAndProject(
                AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS, start, null,
                List.of(tier(5, "900.00"), tier(10, "950.00")), 5, null));

        // A tier may not reach or exceed the starting price.
        assertThrows(IllegalArgumentException.class, () -> pricingService.validateAndProject(
                AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS, start, null,
                List.of(tier(1, "1000.00")), 5, null));

        // Duplicate thresholds would make the ladder ambiguous.
        assertThrows(IllegalArgumentException.class, () -> pricingService.validateAndProject(
                AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS, start, null,
                List.of(tier(5, "900.00"), tier(5, "800.00")), 5, null));

        // A percentage rule needs a percentage, and the floor must sit below the starting price.
        assertThrows(IllegalArgumentException.class, () -> pricingService.validateAndProject(
                AuctionPricingRule.COLLECTIVE_QUANTITY_DISCOUNT, start, null, List.of(), 5, null));
        assertThrows(IllegalArgumentException.class, () -> pricingService.validateAndProject(
                AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS, start, null, List.of(tier(1, "900.00")), 5, start));
    }
}
