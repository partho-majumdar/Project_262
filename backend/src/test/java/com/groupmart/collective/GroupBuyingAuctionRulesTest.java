package com.groupmart.collective;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import com.groupmart.dto.auction.AuctionParticipationRequest;
import com.groupmart.dto.auction.GroupBuyingAuctionRequest;
import com.groupmart.dto.auction.GroupBuyingAuctionTierRequest;
import com.groupmart.entity.*;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The parts of the Group Buying Auction specification that are about correctness of the machinery
 * rather than one worked example: what makes a bid valid, that finalization is one-shot, that the
 * participant count is a headcount, and that money is never approximated.
 */
class GroupBuyingAuctionRulesTest extends AbstractCollectiveIntegrationTest {

    private GroupBuyingAuction openAuction(String sellerEmail, java.util.UUID productId,
                                           int minimumCollective, int available, int minPer, int maxPer) {
        GroupBuyingAuctionRequest request = GroupBuyingAuctionRequest.builder()
                .productId(productId)
                .startingPrice(new BigDecimal("1000.00"))
                .minimumCollectiveQuantity(minimumCollective)
                .availableQuantity(available)
                .minQuantityPerCustomer(minPer)
                .maxQuantityPerCustomer(maxPer)
                .startsAt(LocalDateTime.now().minusMinutes(1))
                .endsAt(LocalDateTime.now().plusDays(3))
                .pricingRule(AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS)
                .tiers(List.of(
                        GroupBuyingAuctionTierRequest.builder().minQuantity(10).unitPrice(new BigDecimal("900.00")).build(),
                        GroupBuyingAuctionTierRequest.builder().minQuantity(20).unitPrice(new BigDecimal("800.00")).build()))
                .build();
        var created = auctionService.createAuction(sellerEmail, request);
        auctionService.publishAuction(sellerEmail, created.getId());
        return auctionRepository.findById(created.getId()).orElseThrow();
    }

    private record Seller(User user, SellerStore store, Product product) {
    }

    private Seller seller() {
        User user = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(user);
        return new Seller(user, store, createProduct(store, createCategory(), new BigDecimal("2000.00"), 1000));
    }

    private com.groupmart.dto.auction.AuctionParticipationDto place(User customer, GroupBuyingAuction auction,
                                                                    int quantity, BigDecimal maxUnitPrice) {
        return auctionParticipationService.placeBid(customer.getEmail(), auction.getId(),
                AuctionParticipationRequest.builder().quantity(quantity).maxUnitPrice(maxUnitPrice)
                        .addressId(createAddress(customer).getId())
                        .paymentMethod(PaymentMethod.CREDIT_CARD).build());
    }

    // ===== Spec 5: bid validity ===============================================================

    @Test
    void aBidBelowThePerCustomerMinimumIsRejectedAndContributesNothing() {
        Seller s = seller();
        GroupBuyingAuction auction = openAuction(s.user().getEmail(), s.product().getId(), 5, 50, 2, 10);
        User customer = createUser("customer", Role.ROLE_CUSTOMER);
        Address address = createAddress(customer);

        assertThrows(RuntimeException.class, () -> auctionParticipationService.placeBid(
                customer.getEmail(), auction.getId(), AuctionParticipationRequest.builder()
                        .quantity(1).maxUnitPrice(new BigDecimal("1000.00"))
                        .addressId(address.getId()).paymentMethod(PaymentMethod.CREDIT_CARD).build()),
                "1 unit is below the minimum of 2");

        var stored = auctionRepository.findById(auction.getId()).orElseThrow();
        assertEquals(0, stored.getCollectiveQuantity(), "an invalid bid never reaches the collective total");
        assertEquals(1000, productRepository.findStockQuantityById(s.product().getId()),
                "an invalid bid reserves no stock");
    }

    @Test
    void aBidAboveThePerCustomerMaximumIsRejected() {
        Seller s = seller();
        GroupBuyingAuction auction = openAuction(s.user().getEmail(), s.product().getId(), 5, 50, 1, 6);
        User customer = createUser("customer", Role.ROLE_CUSTOMER);
        Address address = createAddress(customer);

        assertThrows(RuntimeException.class, () -> auctionParticipationService.placeBid(
                customer.getEmail(), auction.getId(), AuctionParticipationRequest.builder()
                        .quantity(7).maxUnitPrice(new BigDecimal("1000.00"))
                        .addressId(address.getId()).paymentMethod(PaymentMethod.CREDIT_CARD).build()),
                "7 units is above the maximum of 6");
        assertEquals(0, auctionRepository.findById(auction.getId()).orElseThrow().getCollectiveQuantity());
    }

    @Test
    void aBidThatWouldOversellTheAvailableQuantityIsRejected() {
        Seller s = seller();
        GroupBuyingAuction auction = openAuction(s.user().getEmail(), s.product().getId(), 5, 20, 1, 20);
        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);

        place(a, auction, 15, new BigDecimal("1000.00"));
        assertThrows(RuntimeException.class, () -> place(b, auction, 10, new BigDecimal("1000.00")),
                "15 + 10 exceeds the 20 units this auction can absorb");

        var stored = auctionRepository.findById(auction.getId()).orElseThrow();
        assertEquals(15, stored.getCollectiveQuantity());
        assertEquals(5, stored.getRemainingQuantity(), "20 available - 15 bid leaves 5 still biddable");
        assertEquals(985, productRepository.findStockQuantityById(s.product().getId()));
    }

    @Test
    void aBidAboveTheProductShelfPriceIsRejected() {
        Seller s = seller();
        GroupBuyingAuction auction = openAuction(s.user().getEmail(), s.product().getId(), 5, 50, 1, 10);
        User customer = createUser("customer", Role.ROLE_CUSTOMER);
        Address address = createAddress(customer);

        assertThrows(RuntimeException.class, () -> auctionParticipationService.placeBid(
                customer.getEmail(), auction.getId(), AuctionParticipationRequest.builder()
                        .quantity(1).maxUnitPrice(new BigDecimal("2500.00"))
                        .addressId(address.getId()).paymentMethod(PaymentMethod.CREDIT_CARD).build()),
                "nobody pays more than the product's regular price");
    }

    @Test
    void aBidWithSomebodyElsesAddressIsRejected() {
        Seller s = seller();
        GroupBuyingAuction auction = openAuction(s.user().getEmail(), s.product().getId(), 5, 50, 1, 10);
        User customer = createUser("customer", Role.ROLE_CUSTOMER);
        User stranger = createUser("stranger", Role.ROLE_CUSTOMER);
        Address strangerAddress = createAddress(stranger);

        assertThrows(RuntimeException.class, () -> auctionParticipationService.placeBid(
                customer.getEmail(), auction.getId(), AuctionParticipationRequest.builder()
                        .quantity(1).maxUnitPrice(new BigDecimal("1000.00"))
                        .addressId(strangerAddress.getId()).paymentMethod(PaymentMethod.CREDIT_CARD).build()),
                "a shipping address must belong to the bidder");
    }

    @Test
    void aCashPaymentMethodIsRejectedBecauseThereIsNothingToHoldOrRefund() {
        Seller s = seller();
        GroupBuyingAuction auction = openAuction(s.user().getEmail(), s.product().getId(), 5, 50, 1, 10);
        User customer = createUser("customer", Role.ROLE_CUSTOMER);
        Address address = createAddress(customer);

        assertThrows(RuntimeException.class, () -> auctionParticipationService.placeBid(
                customer.getEmail(), auction.getId(), AuctionParticipationRequest.builder()
                        .quantity(1).maxUnitPrice(new BigDecimal("1000.00"))
                        .addressId(address.getId()).paymentMethod(PaymentMethod.CASH_ON_DELIVERY).build()));
    }

    // ===== Spec 4: the participant count is a headcount, not a bid tally =======================

    @Test
    void oneCustomerHoldingSeveralBidsCountsAsOneParticipant() {
        Seller s = seller();
        GroupBuyingAuction auction = openAuction(s.user().getEmail(), s.product().getId(), 20, 60, 1, 20);
        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);

        place(a, auction, 5, new BigDecimal("1000.00"));
        place(b, auction, 5, new BigDecimal("1000.00"));
        // A bids again, so there are three bid rows but still only two customers.
        place(a, auction, 5, new BigDecimal("1000.00"));

        var stored = auctionRepository.findById(auction.getId()).orElseThrow();
        assertEquals(15, stored.getCollectiveQuantity(), "all three valid bid quantities count");
        assertEquals(2, stored.getParticipantCount(),
                "the spec counts participating customers, so A's second bid must not add a third");

        // Withdrawing one of A's bids leaves A still participating.
        var aBids = auctionParticipationRepository.findByAuctionIdOrderByCreatedAtAsc(auction.getId());
        auctionParticipationService.cancelParticipation(a.getEmail(), aBids.get(0).getId(), "changed my mind");
        var after = auctionRepository.findById(auction.getId()).orElseThrow();
        assertEquals(10, after.getCollectiveQuantity());
        assertEquals(2, after.getParticipantCount(), "A still holds a live bid, so A is still a participant");
    }

    // ===== Spec 19: idempotent finalization ====================================================

    @Test
    void finalizingRepeatedlyNeverDuplicatesOrdersRefundsOrRevenue() {
        Seller s = seller();
        GroupBuyingAuction auction = openAuction(s.user().getEmail(), s.product().getId(), 20, 60, 1, 20);
        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        User c = createUser("c", Role.ROLE_CUSTOMER);

        place(a, auction, 15, new BigDecimal("1000.00"));
        place(b, auction, 10, new BigDecimal("1000.00"));
        place(c, auction, 10, new BigDecimal("500.00"));

        auctionFinalizationService.finalizeAuction(auction.getId(), s.user().getEmail(), true);

        var result = auctionResultRepository.findByAuctionId(auction.getId()).orElseThrow();
        assertEquals(0, new BigDecimal("20000.00").compareTo(result.getTotalSuccessfulSales()),
                "15 x 800 + 10 x 800; the outbidder's 10 units are not sold");
        assertEquals(25, result.getWinningQuantity());
        assertEquals(10, result.getOutbidQuantity());
        assertEquals(975, productRepository.findStockQuantityById(s.product().getId()),
                "1000 - 25 sold units; the outbidder's 10 came back");

        long ordersAfterFirst = orderRepository
                .findByOrderTypeOrderByCreatedAtDesc(OrderType.GROUP_BUYING_AUCTION).size();

        // Every route into finalization, repeated.
        auctionFinalizationService.finalizeAuction(auction.getId(), s.user().getEmail(), true);
        auctionService.finalizeExpiredAuction(auction.getId());
        assertDoesNotThrow(() -> auctionService.finalizeExpiredAuction(auction.getId()));
        // A seller cannot cancel an auction that has already settled; that is a refusal, not a
        // second settlement, so it must not move any figure either.
        assertThrows(RuntimeException.class,
                () -> auctionService.cancelAuction(s.user().getEmail(), auction.getId(), "too late"));

        assertEquals(ordersAfterFirst, orderRepository
                        .findByOrderTypeOrderByCreatedAtDesc(OrderType.GROUP_BUYING_AUCTION).size(),
                "one order per winner, no duplicates");
        assertEquals(1, auctionResultRepository.count(), "exactly one result row");
        var reloaded = auctionResultRepository.findByAuctionId(auction.getId()).orElseThrow();
        assertEquals(0, result.getFinalUnitPrice().compareTo(reloaded.getFinalUnitPrice()),
                "the locked price never drifts");
        assertEquals(975, productRepository.findStockQuantityById(s.product().getId()),
                "stock is deducted once and once only");

        var outbid = auctionParticipationRepository.findByAuctionIdOrderByCreatedAtAsc(auction.getId()).stream()
                .filter(p -> p.getStatus() == AuctionParticipationStatus.OUTBID).findFirst().orElseThrow();
        assertEquals(0, outbid.getRefundAmount().compareTo(outbid.getTotalAmount()),
                "the refund amount does not accumulate across repeated runs");
    }

    @Test
    void anAuctionCannotBeFinalizedBeforeItsStartOrAfterItIsAlreadyTerminal() {
        Seller s = seller();
        GroupBuyingAuction auction = openAuction(s.user().getEmail(), s.product().getId(), 5, 50, 1, 10);

        // A deadline sweep must refuse an auction that has not finished yet.
        assertThrows(RuntimeException.class, () -> auctionService.finalizeExpiredAuction(auction.getId()));

        GroupBuyingAuction stored = auctionRepository.findById(auction.getId()).orElseThrow();
        stored.setEndsAt(LocalDateTime.now().minusMinutes(1));
        auctionRepository.saveAndFlush(stored);

        auctionService.finalizeExpiredAuction(auction.getId());
        assertTrue(auctionRepository.findById(auction.getId()).orElseThrow().getStatus().isTerminal());
        // A further sweep is a safe no-op rather than an error.
        assertDoesNotThrow(() -> auctionService.finalizeExpiredAuction(auction.getId()));
    }

    // ===== Spec 16: settled figures must never read as zero against real orders ===============

    /**
     * A result row finalized before the aggregate columns existed stores zeroes, and because
     * finalization is one-shot it is never rewritten. A seller then saw "0 unit(s) sold" and
     * "total successful sales 0.00" beside three delivered orders. The figures have to be derived
     * from the settled bids and their orders, not read off the row.
     */
    @Test
    void aResultRowWithZeroedAggregatesStillReportsWhatWasActuallySold() {
        Seller s = seller();
        // Minimum 10, and 3 + 5 + 2 = 10 reach it, so the auction succeeds on the 10+ tier at 900.
        GroupBuyingAuction auction = openAuction(s.user().getEmail(), s.product().getId(), 10, 200, 1, 20);
        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        User c = createUser("c", Role.ROLE_CUSTOMER);
        place(a, auction, 3, new BigDecimal("1000.00"));
        place(b, auction, 5, new BigDecimal("1000.00"));
        place(c, auction, 2, new BigDecimal("1000.00"));

        auctionFinalizationService.finalizeAuction(auction.getId(), s.user().getEmail(), true);

        // Reproduce a row written before the aggregates existed.
        var stored = auctionResultRepository.findByAuctionId(auction.getId()).orElseThrow();
        stored.setWinningQuantity(0);
        stored.setOutbidQuantity(0);
        stored.setTotalSuccessfulSales(BigDecimal.ZERO);
        auctionResultRepository.saveAndFlush(stored);

        var reported = auctionService.getResult(auction.getId());

        assertEquals(3, reported.getWinningBidCount());
        assertEquals(10, reported.getWinningQuantity(),
                "3 + 5 + 2 units were sold; the stored zero must not be served");
        assertEquals(0, reported.getOutbidQuantity());
        assertEquals(0, new BigDecimal("9000.00").compareTo(reported.getTotalSuccessfulSales()),
                "10 units at the 900 clearing price");
        assertEquals(0, new BigDecimal("900.00")
                        .multiply(BigDecimal.valueOf(reported.getWinningQuantity()))
                        .compareTo(reported.getTotalSuccessfulSales()),
                "the reported revenue must equal the reported units at the locked price");
    }

    /** The same rule applies to a genuinely successful auction where every bidder won. */
    @Test
    void derivedFiguresAgreeWithTheStoredOnesForAFreshlyFinalizedAuction() {
        Seller s = seller();
        GroupBuyingAuction auction = openAuction(s.user().getEmail(), s.product().getId(), 20, 200, 1, 20);
        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        place(a, auction, 10, new BigDecimal("1000.00"));
        place(b, auction, 12, new BigDecimal("1000.00"));

        auctionFinalizationService.finalizeAuction(auction.getId(), s.user().getEmail(), true);

        var stored = auctionResultRepository.findByAuctionId(auction.getId()).orElseThrow();
        var reported = auctionService.getResult(auction.getId());

        assertEquals(stored.getWinningQuantity(), reported.getWinningQuantity(),
                "a fresh result already agrees; the derivation must not change the answer");
        assertEquals(stored.getOutbidQuantity(), reported.getOutbidQuantity());
        assertEquals(0, stored.getTotalSuccessfulSales().compareTo(reported.getTotalSuccessfulSales()));
        assertEquals(22, reported.getWinningQuantity());
        assertEquals(0, new BigDecimal("17600.00").compareTo(reported.getTotalSuccessfulSales()),
                "22 units at 800");
    }

    // ===== Spec 21 and 24: who can see what ====================================================

    @Test
    void aSellerSeesWhichCustomerEachBidCameFromAndCannotSeeAnotherSellersBids() {
        Seller s = seller();
        GroupBuyingAuction auction = openAuction(s.user().getEmail(), s.product().getId(), 20, 60, 1, 20);
        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        place(a, auction, 5, new BigDecimal("1000.00"));
        place(b, auction, 5, new BigDecimal("1000.00"));

        auctionFinalizationService.finalizeAuction(auction.getId(), s.user().getEmail(), true);

        // The seller has to be able to tell the winning and outbid customers apart.
        var forSeller = auctionService.getSellerAuctionParticipations(s.user().getEmail(), auction.getId());
        assertEquals(2, forSeller.size());
        assertEquals(Set.of(a.getEmail(), b.getEmail()),
                forSeller.stream().map(bid -> bid.getUserEmail()).collect(java.util.stream.Collectors.toSet()),
                "every bidder is identified by name and email for the seller");
        assertTrue(forSeller.stream().allMatch(bid -> bid.getUserName() != null && !bid.getUserName().isBlank()));

        // And a different seller is refused the whole thing.
        User other = createUser("other", Role.ROLE_SELLER);
        createSellerStore(other);
        assertThrows(RuntimeException.class,
                () -> auctionService.getSellerAuctionParticipations(other.getEmail(), auction.getId()));
    }

    @Test
    void aCustomerOnlyEverSeesTheirOwnBids() {
        Seller s = seller();
        GroupBuyingAuction auction = openAuction(s.user().getEmail(), s.product().getId(), 20, 60, 1, 20);
        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        place(a, auction, 5, new BigDecimal("1000.00"));
        place(b, auction, 5, new BigDecimal("1000.00"));

        var aSees = auctionParticipationService.getMyParticipations(a.getEmail());
        assertEquals(1, aSees.size(), "a customer's list is scoped to themselves");
        assertEquals(a.getEmail(), aSees.get(0).getUserEmail());
        assertEquals("BID_PLACED", aSees.get(0).getStatus().name());
        assertEquals(10, aSees.get(0).getAuctionCollectiveQuantity(),
                "the customer sees the collective total their own quantity joined: 5 + 5");
    }

    // ===== Spec 7 and 30: money precision =====================================================

    @Test
    void aPercentageDiscountIsAppliedOnceAndRoundedToWholeCents() {
        // 10% off 1000 is exactly 900; a percentage that does not divide evenly must round HALF_UP.
        List<AuctionPricingServiceTier> checks = List.of(
                new AuctionPricingServiceTier(new BigDecimal("1000.00"), new BigDecimal("10.00"), new BigDecimal("900.00")),
                new AuctionPricingServiceTier(new BigDecimal("1000.00"), new BigDecimal("33.33"), new BigDecimal("666.70")),
                new AuctionPricingServiceTier(new BigDecimal("999.99"), new BigDecimal("15.00"), new BigDecimal("849.99")));

        for (AuctionPricingServiceTier check : checks) {
            BigDecimal actual = auctionPricingService.calculateFrom(
                    AuctionPricingRule.COLLECTIVE_QUANTITY_DISCOUNT, check.startingPrice(),
                    check.discount(), List.of(), 0);
            assertEquals(0, check.expected().compareTo(actual),
                    "discount applied exactly once to " + check.startingPrice() + " at " + check.discount() + "%");
            assertEquals(2, actual.scale(), "money carries exactly two decimal places");
        }
    }

    private record AuctionPricingServiceTier(BigDecimal startingPrice, BigDecimal discount, BigDecimal expected) {
    }

    @Test
    void winnerOrderTotalsAreExactAcrossManyBidders() {
        Seller s = seller();
        GroupBuyingAuction auction = openAuction(s.user().getEmail(), s.product().getId(), 20, 200, 1, 20);

        // Ten customers, quantities that do not divide the price evenly, one guaranteed outbidder.
        BigDecimal expectedRevenue = BigDecimal.ZERO;
        for (int i = 0; i < 9; i++) {
            User customer = createUser("w" + i, Role.ROLE_CUSTOMER);
            int qty = 1 + i;
            place(customer, auction, qty, new BigDecimal("1000.00"));
            expectedRevenue = expectedRevenue.add(new BigDecimal("800.00").multiply(BigDecimal.valueOf(qty)));
        }
        User loser = createUser("loser", Role.ROLE_CUSTOMER);
        place(loser, auction, 20, new BigDecimal("100.00"));

        auctionFinalizationService.finalizeAuction(auction.getId(), s.user().getEmail(), true);

        var result = auctionResultRepository.findByAuctionId(auction.getId()).orElseThrow();
        assertEquals(0, expectedRevenue.compareTo(result.getTotalSuccessfulSales()),
                "the sum of the individual orders must equal the reported revenue exactly");
        assertEquals(45, result.getWinningQuantity());
        assertEquals(20, result.getOutbidQuantity());

        // Each individual order total must equal quantity x the locked price, to the cent.
        for (var participation : auctionParticipationRepository
                .findByAuctionIdOrderByCreatedAtAsc(auction.getId())) {
            if (participation.getStatus() != AuctionParticipationStatus.WON) {
                continue;
            }
            var order = orderRepository.findById(participation.getOrder().getId()).orElseThrow();
            BigDecimal expectedLine = new BigDecimal("800.00")
                    .multiply(BigDecimal.valueOf(participation.getQuantity()));
            assertEquals(0, expectedLine.compareTo(order.getTotalAmount()));
            assertEquals(0, order.getTotalAmount().compareTo(participation.getTotalAmount()),
                    "the order and the participation agree on the amount charged");
        }
    }
}
