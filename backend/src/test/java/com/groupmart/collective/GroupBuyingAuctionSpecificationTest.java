package com.groupmart.collective;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.groupmart.dto.auction.AuctionParticipationRequest;
import com.groupmart.dto.auction.GroupBuyingAuctionRequest;
import com.groupmart.dto.auction.GroupBuyingAuctionTierRequest;
import com.groupmart.entity.*;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The Group Buying Auction specification, scenario for scenario.
 * <p>
 * These cases are the contract, written out literally: the same starting price, the same 10/20/30
 * tier ladder, the same three bids and the same expected figures. They are deliberately not
 * refactored into helpers, because the point of a specification test is that a reader can check the
 * arithmetic against the spec without following any indirection.
 * <p>
 * The mechanism under test is a collective auction, not a highest-bid-wins one. Quantities build a
 * collective total, the seller's rule turns that total into one clearing price, and only then is each
 * bidder's private maximum compared against it.
 */
class GroupBuyingAuctionSpecificationTest extends AbstractCollectiveIntegrationTest {

    // Spec 2: the seller's configuration.
    private static final BigDecimal STARTING_PRICE = new BigDecimal("1000");
    private static final BigDecimal TIER_10 = new BigDecimal("950");
    private static final BigDecimal TIER_20 = new BigDecimal("900");
    private static final BigDecimal TIER_30 = new BigDecimal("850");
    private static final int MIN_COLLECTIVE = 20;
    private static final BigDecimal MIN_SELLER_UNIT_PRICE = new BigDecimal("800");

    /** The product's shelf price must be at least the highest ceiling any spec bidder submits. */
    private GroupBuyingAuction specAuction(int minimumCollective, BigDecimal sellerFloor,
                                           List<GroupBuyingAuctionTierRequest> tiers,
                                           int availableQuantity, int maxPerCustomer) {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("2000.00"), 200);

        GroupBuyingAuctionRequest request = GroupBuyingAuctionRequest.builder()
                .productId(product.getId())
                .startingPrice(STARTING_PRICE)
                .minimumSellerUnitPrice(sellerFloor)
                .minimumCollectiveQuantity(minimumCollective)
                .availableQuantity(availableQuantity)
                .minQuantityPerCustomer(1)
                .maxQuantityPerCustomer(maxPerCustomer)
                .startsAt(LocalDateTime.now().minusMinutes(1))
                .endsAt(LocalDateTime.now().plusDays(3))
                .pricingRule(AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS)
                .tiers(tiers)
                .build();
        var created = auctionService.createAuction(seller.getEmail(), request);
        auctionService.publishAuction(seller.getEmail(), created.getId());
        return auctionRepository.findById(created.getId()).orElseThrow();
    }

    private com.groupmart.dto.auction.AuctionParticipationDto bid(User customer, GroupBuyingAuction auction,
                                                                  int quantity, BigDecimal maxUnitPrice) {
        Address address = createAddress(customer);
        return auctionParticipationService.placeBid(customer.getEmail(), auction.getId(),
                AuctionParticipationRequest.builder()
                        .quantity(quantity)
                        .maxUnitPrice(maxUnitPrice)
                        .addressId(address.getId())
                        .paymentMethod(PaymentMethod.CREDIT_CARD)
                        .build());
    }

    private static List<GroupBuyingAuctionTierRequest> specTiers() {
        return List.of(
                GroupBuyingAuctionTierRequest.builder().minQuantity(10).unitPrice(TIER_10).build(),
                GroupBuyingAuctionTierRequest.builder().minQuantity(20).unitPrice(TIER_20).build(),
                GroupBuyingAuctionTierRequest.builder().minQuantity(30).unitPrice(TIER_30).build());
    }

    // ===== Spec 25: the exact scenario ==========================================================

    @Test
    void specScenarioClearsAtThirtyUnitsAndSplitsWinnersFromOutbidBidders() {
        GroupBuyingAuction auction = specAuction(MIN_COLLECTIVE, MIN_SELLER_UNIT_PRICE, specTiers(), 40, 20);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        User c = createUser("c", Role.ROLE_CUSTOMER);

        var bidA = bid(a, auction, 5, new BigDecimal("1000"));
        var bidB = bid(b, auction, 10, new BigDecimal("900"));
        var bidC = bid(c, auction, 15, new BigDecimal("800"));

        // Spec 4: only valid bid quantities build the collective total.
        GroupBuyingAuction running = auctionRepository.findById(auction.getId()).orElseThrow();
        assertEquals(30, running.getCollectiveQuantity(), "5 + 10 + 15");
        assertEquals(3, running.getParticipantCount(), "three distinct participating customers");

        auctionFinalizationService.finalizeAuction(auction.getId(), "seller@example.com", true);

        // Spec 6/11: 30 units clears the 30+ tier at 850.
        var result = auctionResultRepository.findByAuctionId(auction.getId()).orElseThrow();
        assertEquals(0, TIER_30.compareTo(result.getFinalUnitPrice()),
                "the 30+ tier must be selected at a collective quantity of exactly 30");
        assertEquals(0, TIER_30.compareTo(
                auctionRepository.findById(auction.getId()).orElseThrow().getFinalUnitPrice()));

        // Spec 11: eligibility is checked after the price is locked.
        var savedA = auctionParticipationRepository.findById(bidA.getId()).orElseThrow();
        var savedB = auctionParticipationRepository.findById(bidB.getId()).orElseThrow();
        var savedC = auctionParticipationRepository.findById(bidC.getId()).orElseThrow();

        assertEquals(AuctionParticipationStatus.WON, savedA.getStatus(), "1000 >= 850");
        assertEquals(AuctionParticipationStatus.WON, savedB.getStatus(), "900 >= 850");
        assertEquals(AuctionParticipationStatus.OUTBID, savedC.getStatus(), "800 < 850");

        // Spec 15: the outbidder gets no order and a full refund.
        assertNull(savedC.getOrder(), "an outbid bid must not produce an order");
        assertEquals(PaymentStatus.REFUNDED, savedC.getPaymentStatus());
        assertEquals(0, savedC.getRefundAmount().compareTo(savedC.getTotalAmount()),
                "the full held amount comes back");

        // Spec 13/14: one individual order per winner, each at the single clearing price.
        Order orderA = orderRepository.findById(savedA.getOrder().getId()).orElseThrow();
        Order orderB = orderRepository.findById(savedB.getOrder().getId()).orElseThrow();
        assertEquals(0, new BigDecimal("4250.00").compareTo(orderA.getTotalAmount()), "5 x 850");
        assertEquals(0, new BigDecimal("8500.00").compareTo(orderB.getTotalAmount()), "10 x 850");
        assertEquals(0, TIER_30.compareTo(orderA.getItems().get(0).getUnitPrice()),
                "A's 1000 ceiling is never charged; the winner pays the clearing price");
        assertEquals(0, TIER_30.compareTo(orderB.getItems().get(0).getUnitPrice()),
                "every winner pays exactly the same unit price");

        // Spec 16: winning quantity is 15 of the 30 collectively bid, revenue is 12750.
        assertEquals(15, result.getWinningQuantity(), "5 + 10; the outbidder's 15 are not sold");
        assertEquals(15, result.getOutbidQuantity());
        assertEquals(0, new BigDecimal("12750.00").compareTo(result.getTotalSuccessfulSales()),
                "4250 + 8500; outbid quantity is never counted as revenue");
        assertEquals(2, result.getWinningBidCount());
        assertEquals(1, result.getOutbidCount());
        assertEquals(3, result.getBidderCount());
        assertEquals(30, result.getCollectiveQuantity(),
                "C's quantity stays in the collective total even though C is outbid (spec 11)");

        // Spec 17: only the 15 winning units leave stock permanently.
        assertEquals(200 - 15, productRepository.findStockQuantityById(auction.getProduct().getId()),
                "C's 15 reserved units go back on sale; A's 5 and B's 10 stay sold");
    }

    // ===== Spec 26: all three bidders win ======================================================

    @Test
    void specScenarioTwoGivesAllThreeBiddersAnOrderAtTheSameClearingPrice() {
        GroupBuyingAuction auction = specAuction(MIN_COLLECTIVE, MIN_SELLER_UNIT_PRICE, specTiers(), 40, 20);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        User c = createUser("c", Role.ROLE_CUSTOMER);

        var bidA = bid(a, auction, 5, new BigDecimal("1000"));
        var bidB = bid(b, auction, 10, new BigDecimal("900"));
        var bidC = bid(c, auction, 15, new BigDecimal("850"));

        assertEquals(30, auctionRepository.findById(auction.getId()).orElseThrow().getCollectiveQuantity());
        auctionFinalizationService.finalizeAuction(auction.getId(), "seller@example.com", true);

        var result = auctionResultRepository.findByAuctionId(auction.getId()).orElseThrow();
        assertEquals(0, TIER_30.compareTo(result.getFinalUnitPrice()));

        for (var bidId : List.of(bidA.getId(), bidB.getId(), bidC.getId())) {
            var saved = auctionParticipationRepository.findById(bidId).orElseThrow();
            assertEquals(AuctionParticipationStatus.WON, saved.getStatus(), "850 >= 850 is a win, not a loss");
        }

        // Spec 12: identical unit price for all three despite three different ceilings.
        assertEquals(0, new BigDecimal("4250.00").compareTo(
                orderRepository.findById(auctionParticipationRepository.findById(bidA.getId()).orElseThrow()
                        .getOrder().getId()).orElseThrow().getTotalAmount()));
        assertEquals(0, new BigDecimal("8500.00").compareTo(
                orderRepository.findById(auctionParticipationRepository.findById(bidB.getId()).orElseThrow()
                        .getOrder().getId()).orElseThrow().getTotalAmount()));
        assertEquals(0, new BigDecimal("12750.00").compareTo(
                orderRepository.findById(auctionParticipationRepository.findById(bidC.getId()).orElseThrow()
                        .getOrder().getId()).orElseThrow().getTotalAmount()));

        assertEquals(30, result.getWinningQuantity());
        assertEquals(0, result.getOutbidQuantity());
        assertEquals(3, result.getWinningBidCount());
        assertEquals(0, result.getOutbidCount());
        assertEquals(0, new BigDecimal("25500.00").compareTo(result.getTotalSuccessfulSales()),
                "all three orders are sold: 4250 + 8500 + 12750");
    }

    // ===== Spec 27: minimum collective quantity not met ========================================

    @Test
    void specScenarioThreeFailsTheAuctionAndRefundsEveryone() {
        GroupBuyingAuction auction = specAuction(50, MIN_SELLER_UNIT_PRICE, specTiers(), 60, 20);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        User c = createUser("c", Role.ROLE_CUSTOMER);

        var bidA = bid(a, auction, 10, new BigDecimal("1000"));
        var bidB = bid(b, auction, 10, new BigDecimal("900"));
        var bidC = bid(c, auction, 15, new BigDecimal("800"));

        GroupBuyingAuction running = auctionRepository.findById(auction.getId()).orElseThrow();
        assertEquals(35, running.getCollectiveQuantity(), "10 + 10 + 15");
        assertTrue(running.getCollectiveQuantity() < running.getMinimumCollectiveQuantity());

        auctionFinalizationService.finalizeAuction(auction.getId(), "seller@example.com", true);

        GroupBuyingAuction failed = auctionRepository.findById(auction.getId()).orElseThrow();
        assertEquals(GroupBuyingAuctionStatus.FAILED, failed.getStatus());
        assertNull(failed.getFinalUnitPrice(), "no price is ever locked on a failed auction");
        assertTrue(auctionResultRepository.findByAuctionId(auction.getId()).isEmpty(),
                "a failed auction records no successful allocation");

        for (var bidId : List.of(bidA.getId(), bidB.getId(), bidC.getId())) {
            var saved = auctionParticipationRepository.findById(bidId).orElseThrow();
            assertEquals(AuctionParticipationStatus.REFUNDED, saved.getStatus());
            assertEquals(PaymentStatus.REFUNDED, saved.getPaymentStatus());
            assertEquals(0, saved.getRefundAmount().compareTo(saved.getTotalAmount()));
            assertNull(saved.getOrder(), "a failed auction creates no orders");
        }

        assertEquals(0, orderRepository.findByOrderTypeOrderByCreatedAtDesc(OrderType.GROUP_BUYING_AUCTION).size());
        assertEquals(200, productRepository.findStockQuantityById(auction.getProduct().getId()),
                "every reservation is released");
    }

    // ===== Spec 28: the seller's price floor ===================================================

    @Test
    void specScenarioFourLiftsTheClearingPriceToTheSellersFloor() {
        // The ladder prices the units at 800, but the seller's floor is 850.
        List<GroupBuyingAuctionTierRequest> cheapLadder = List.of(
                GroupBuyingAuctionTierRequest.builder().minQuantity(1).unitPrice(new BigDecimal("800")).build());
        GroupBuyingAuction auction = specAuction(20, new BigDecimal("850"), cheapLadder, 40, 20);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        bid(a, auction, 20, new BigDecimal("1000"));

        auctionFinalizationService.finalizeAuction(auction.getId(), "seller@example.com", true);

        var result = auctionResultRepository.findByAuctionId(auction.getId()).orElseThrow();
        assertEquals(0, new BigDecimal("850.00").compareTo(result.getFinalUnitPrice()),
                "MAX(calculated 800, seller floor 850) = 850");
    }

    // ===== Spec 29: exact tier boundaries =======================================================

    @Test
    void specScenarioFiveResolvesEveryTierBoundaryExactly() {
        List<AuctionPricingServiceTier> expected = List.of(
                new AuctionPricingServiceTier(9, null),
                new AuctionPricingServiceTier(10, TIER_10),
                new AuctionPricingServiceTier(19, TIER_10),
                new AuctionPricingServiceTier(20, TIER_20),
                new AuctionPricingServiceTier(29, TIER_20),
                new AuctionPricingServiceTier(30, TIER_30));

        List<GroupBuyingAuctionTierRequest> tiers = specTiers();
        for (AuctionPricingServiceTier step : expected) {
            BigDecimal actual = auctionPricingService.calculateFrom(
                    AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS, STARTING_PRICE, null,
                    tiers.stream().map(t -> com.groupmart.dto.auction.AuctionTierDto.builder()
                            .minQuantity(t.getMinQuantity()).unitPrice(t.getUnitPrice()).build()).toList(),
                    step.quantity());

            if (step.expectedPrice() == null) {
                assertEquals(0, STARTING_PRICE.compareTo(actual),
                        "at " + step.quantity() + " units no tier is reached, so the starting price stands");
            } else {
                assertEquals(0, step.expectedPrice().compareTo(actual),
                        "collective quantity " + step.quantity() + " must select the right tier");
            }
        }
    }

    private record AuctionPricingServiceTier(int quantity, BigDecimal expectedPrice) {
    }
}
