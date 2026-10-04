package com.groupmart.collective;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.groupmart.dto.auction.AuctionParticipationRequest;
import com.groupmart.dto.auction.GroupBuyingAuctionRequest;
import com.groupmart.dto.auction.GroupBuyingAuctionTierRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.ProductRepository;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Group Buying Auction happy path: the seller configures the mechanism, customers bid independently,
 * the auction reaches its completion condition, the final price is locked by the pricing engine, and
 * each winning bid becomes its own individual order at that price.
 */
class GroupBuyingAuctionFlowTest extends AbstractCollectiveIntegrationTest {

    @Test
    void finalizingLocksThePriceAndGivesEveryWinnerAnOrderAtIt() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("120.00"), 20);

        // Test 1: the seller creates and publishes a tiered auction.
        GroupBuyingAuction auction = createOpenTieredAuction(seller.getEmail(), product.getId(),
                new BigDecimal("100.00"), 4, 15, 1, 5, LocalDateTime.now().plusDays(3));
        assertEquals(GroupBuyingAuctionStatus.OPEN, auction.getStatus());
        assertEquals(AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS, auction.getPricingRule());
        assertEquals(3, auctionTierRepository.findByAuctionIdOrderByMinQuantityAsc(auction.getId()).size());
        assertEquals(new BigDecimal("100.00"), auction.getStartingPrice());

        User customerA = createUser("customerA", Role.ROLE_CUSTOMER);
        Address addressA = createAddress(customerA);
        User customerB = createUser("customerB", Role.ROLE_CUSTOMER);
        Address addressB = createAddress(customerB);

        // Test 2 + 3: two customers bid independently. Both bid high enough to win.
        var bidA = auctionParticipationService.placeBid(customerA.getEmail(), auction.getId(),
                AuctionParticipationRequest.builder().quantity(3).maxUnitPrice(new BigDecimal("100.00"))
                        .addressId(addressA.getId()).paymentMethod(PaymentMethod.CREDIT_CARD).build());
        assertEquals(AuctionParticipationStatus.BID_PLACED, bidA.getStatus());
        assertEquals(3, bidA.getAuctionCollectiveQuantity());

        var bidB = auctionParticipationService.placeBid(customerB.getEmail(), auction.getId(),
                AuctionParticipationRequest.builder().quantity(4).maxUnitPrice(new BigDecimal("100.00"))
                        .addressId(addressB.getId()).paymentMethod(PaymentMethod.STRIPE).build());

        GroupBuyingAuction running = auctionRepository.findById(auction.getId()).orElseThrow();
        assertEquals(7, running.getCollectiveQuantity());
        assertEquals(2, running.getParticipantCount());
        assertEquals(13, productRepository.findStockQuantityById(product.getId()),
                "Each bid reserves its own units out of sellable stock");
        assertTrue(auctionResultRepository.findByAuctionId(auction.getId()).isEmpty(),
                "No result before the auction is finalized");

        // Test 5: the configured ladder prices 7 collectively bid units at 90 (the 5+ rung).
        assertEquals(0, auctionPricingService.calculateUnitPrice(running, 7).compareTo(new BigDecimal("90.00")));

        // Test 6 + 8: the seller finalizes; the final price is computed once and locked.
        var finalized = auctionFinalizationService.finalizeAuction(auction.getId(), seller.getEmail(), true);
        assertEquals(GroupBuyingAuctionStatus.COMPLETED, finalized.getStatus());
        assertEquals(new BigDecimal("90.00"), finalized.getFinalUnitPrice());
        assertTrue(finalized.isFinalized());

        var result = auctionResultRepository.findByAuctionId(auction.getId()).orElseThrow();
        assertEquals(new BigDecimal("90.00"), result.getFinalUnitPrice());
        assertEquals(7, result.getCollectiveQuantity());
        assertEquals(2, result.getWinningBidCount());
        assertEquals(0, result.getOutbidCount());
        assertEquals(seller.getId(), result.getFinalizedBy().getId());

        // Test 9 + 10: one individual order per winner, all at the locked final price.
        var savedA = auctionParticipationRepository.findById(bidA.getId()).orElseThrow();
        var savedB = auctionParticipationRepository.findById(bidB.getId()).orElseThrow();
        assertEquals(AuctionParticipationStatus.WON, savedA.getStatus());
        assertEquals(AuctionParticipationStatus.WON, savedB.getStatus());

        Order orderA = orderRepository.findById(savedA.getOrder().getId()).orElseThrow();
        Order orderB = orderRepository.findById(savedB.getOrder().getId()).orElseThrow();
        assertEquals(OrderType.GROUP_BUYING_AUCTION, orderA.getOrderType());
        assertEquals(auction.getId(), orderA.getGroupBuyingAuctionId());
        assertNull(orderA.getWholesalePurchaseId(), "An auction order must not be linked to a CWP purchase");
        assertNull(orderA.getReverseGroupBuyingCampaignId());
        assertEquals(new BigDecimal("270.00"), orderA.getTotalAmount(), "3 units x the locked 90");
        assertEquals(new BigDecimal("360.00"), orderB.getTotalAmount(), "4 units x the locked 90");
        assertEquals(new BigDecimal("90.00"), orderA.getItems().get(0).getUnitPrice());
        assertEquals(customerA.getId(), orderA.getUser().getId());
        assertEquals(customerB.getId(), orderB.getUser().getId());
        assertFalse(paymentTransactionRepository.findByOrderIdOrderByCreatedAtDesc(orderA.getId()).isEmpty());
        assertEquals(13, productRepository.findStockQuantityById(product.getId()),
                "Won bids stay sold");

        // Test 12: an auction can never be finalized twice, and the result never drifts.
        assertDoesNotThrow(() -> auctionFinalizationService.finalizeAuction(auction.getId(), seller.getEmail(), true));
        assertDoesNotThrow(() -> auctionService.finalizeExpiredAuction(auction.getId()));
        assertEquals(2, orderRepository.findByOrderTypeOrderByCreatedAtDesc(OrderType.GROUP_BUYING_AUCTION).size());
        assertEquals(new BigDecimal("90.00"),
                auctionRepository.findById(auction.getId()).orElseThrow().getFinalUnitPrice());
        assertEquals(1L, auctionResultRepository.count());
    }

    @Test
    void aBidBelowTheClearingPriceIsOutbidRefundedAndItsUnitsReleased() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("120.00"), 20);

        GroupBuyingAuction auction = createOpenTieredAuction(seller.getEmail(), product.getId(),
                new BigDecimal("100.00"), 4, 15, 1, 6, LocalDateTime.now().plusDays(3));

        User winner = createUser("winner", Role.ROLE_CUSTOMER);
        Address winnerAddress = createAddress(winner);
        User outbidder = createUser("outbidder", Role.ROLE_CUSTOMER);
        Address outbidderAddress = createAddress(outbidder);

        var highBid = auctionParticipationService.placeBid(winner.getEmail(), auction.getId(),
                AuctionParticipationRequest.builder().quantity(6).maxUnitPrice(new BigDecimal("100.00"))
                        .addressId(winnerAddress.getId()).paymentMethod(PaymentMethod.CREDIT_CARD).build());
        // Willing to pay only 80, but the collective clears at 90.
        var lowBid = auctionParticipationService.placeBid(outbidder.getEmail(), auction.getId(),
                AuctionParticipationRequest.builder().quantity(2).maxUnitPrice(new BigDecimal("80.00"))
                        .addressId(outbidderAddress.getId()).paymentMethod(PaymentMethod.PAYPAL).build());
        assertEquals(12, productRepository.findStockQuantityById(product.getId()));

        auctionFinalizationService.finalizeAuction(auction.getId(), seller.getEmail(), true);

        assertEquals(new BigDecimal("90.00"),
                auctionRepository.findById(auction.getId()).orElseThrow().getFinalUnitPrice());

        var savedLow = auctionParticipationRepository.findById(lowBid.getId()).orElseThrow();
        assertEquals(AuctionParticipationStatus.OUTBID, savedLow.getStatus());
        assertEquals(PaymentStatus.REFUNDED, savedLow.getPaymentStatus());
        assertEquals(0, savedLow.getTotalAmount().compareTo(savedLow.getRefundAmount()), "Full refund of the bid");
        assertNull(savedLow.getOrder(), "An outbid bid must not produce an order");
        assertEquals(14, productRepository.findStockQuantityById(product.getId()),
                "The outbidder's units go back on sale");

        var savedHigh = auctionParticipationRepository.findById(highBid.getId()).orElseThrow();
        assertEquals(AuctionParticipationStatus.WON, savedHigh.getStatus());
        assertEquals(new BigDecimal("540.00"),
                orderRepository.findById(savedHigh.getOrder().getId()).orElseThrow().getTotalAmount());

        var result = auctionResultRepository.findByAuctionId(auction.getId()).orElseThrow();
        assertEquals(1, result.getWinningBidCount());
        assertEquals(1, result.getOutbidCount());
    }

    @Test
    void anAuctionThatMissesItsMinimumCollectiveQuantityFailsAndRefundsEveryBid() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("120.00"), 20);

        GroupBuyingAuction auction = createOpenTieredAuction(seller.getEmail(), product.getId(),
                new BigDecimal("100.00"), 6, 15, 1, 5, LocalDateTime.now().plusDays(3));

        User customer = createUser("customer", Role.ROLE_CUSTOMER);
        Address address = createAddress(customer);
        var bid = auctionParticipationService.placeBid(customer.getEmail(), auction.getId(),
                AuctionParticipationRequest.builder().quantity(2).maxUnitPrice(new BigDecimal("100.00"))
                        .addressId(address.getId()).paymentMethod(PaymentMethod.CREDIT_CARD).build());
        assertEquals(18, productRepository.findStockQuantityById(product.getId()));

        // The window then closes without the minimum collective quantity being reached.
        GroupBuyingAuction stored = auctionRepository.findById(auction.getId()).orElseThrow();
        stored.setEndsAt(LocalDateTime.now().minusSeconds(30));
        auctionRepository.saveAndFlush(stored);

        // Test 7: the deadline sweep finalizes it below the minimum.
        auctionService.finalizeExpiredAuction(auction.getId());

        GroupBuyingAuction failed = auctionRepository.findById(auction.getId()).orElseThrow();
        assertEquals(GroupBuyingAuctionStatus.FAILED, failed.getStatus());
        assertEquals(GroupBuyingAuctionCloseCode.DEADLINE_REACHED_BELOW_MINIMUM, failed.getCloseCode());
        assertNull(failed.getFinalUnitPrice(), "A failed auction never locks a price");

        var refunded = auctionParticipationRepository.findById(bid.getId()).orElseThrow();
        assertEquals(AuctionParticipationStatus.REFUNDED, refunded.getStatus());
        assertEquals(PaymentStatus.REFUNDED, refunded.getPaymentStatus());
        assertNull(refunded.getOrder());
        assertEquals(20, productRepository.findStockQuantityById(product.getId()));
        assertTrue(auctionResultRepository.findByAuctionId(auction.getId()).isEmpty(),
                "A failed auction records no result, so nothing can be charged against it");
        assertEquals(0, orderRepository.findByOrderTypeOrderByCreatedAtDesc(OrderType.GROUP_BUYING_AUCTION).size());
    }

    @Test
    void aBidAfterTheEndTimeIsRejectedByTheServer() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("120.00"), 20);

        GroupBuyingAuction auction = createOpenTieredAuction(seller.getEmail(), product.getId(),
                new BigDecimal("100.00"), 2, 15, 1, 5, LocalDateTime.now().plusDays(3));

        // Move the window's end into the past, as the clock would.
        GroupBuyingAuction stored = auctionRepository.findById(auction.getId()).orElseThrow();
        stored.setEndsAt(LocalDateTime.now().minusMinutes(1));
        auctionRepository.saveAndFlush(stored);

        User customer = createUser("customer", Role.ROLE_CUSTOMER);
        Address address = createAddress(customer);
        assertThrows(RuntimeException.class, () -> auctionParticipationService.placeBid(customer.getEmail(), auction.getId(),
                AuctionParticipationRequest.builder().quantity(1).maxUnitPrice(new BigDecimal("100.00"))
                        .addressId(address.getId()).paymentMethod(PaymentMethod.CREDIT_CARD).build()));
        assertEquals(20, productRepository.findStockQuantityById(product.getId()));
    }

    @Test
    void aScheduledAuctionOpensAutomaticallyAtItsStartTime() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("120.00"), 20);

        GroupBuyingAuctionRequest request = GroupBuyingAuctionRequest.builder()
                .productId(product.getId())
                .startingPrice(new BigDecimal("100.00"))
                .minimumCollectiveQuantity(2)
                .availableQuantity(10)
                .minQuantityPerCustomer(1)
                .maxQuantityPerCustomer(5)
                .startsAt(LocalDateTime.now().plusMinutes(30))
                .endsAt(LocalDateTime.now().plusDays(3))
                .pricingRule(AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS)
                .tiers(java.util.List.of(
                        GroupBuyingAuctionTierRequest.builder().minQuantity(1).unitPrice(new BigDecimal("90.00")).build()))
                .build();
        var created = auctionService.createAuction(seller.getEmail(), request);
        var published = auctionService.publishAuction(seller.getEmail(), created.getId());
        assertEquals(GroupBuyingAuctionStatus.SCHEDULED, published.getStatus(),
                "A future start time schedules the auction instead of opening it");

        // Nothing opens early.
        assertDoesNotThrow(() -> auctionService.openDueAuction(created.getId()));
        assertEquals(GroupBuyingAuctionStatus.SCHEDULED,
                auctionRepository.findById(created.getId()).orElseThrow().getStatus());

        // Once the start time arrives the scheduler opens it.
        GroupBuyingAuction stored = auctionRepository.findById(created.getId()).orElseThrow();
        stored.setStartsAt(LocalDateTime.now().minusMinutes(1));
        auctionRepository.saveAndFlush(stored);
        auctionService.openDueAuction(created.getId());
        assertEquals(GroupBuyingAuctionStatus.OPEN,
                auctionRepository.findById(created.getId()).orElseThrow().getStatus());
    }

    @Test
    void withdrawingABidBeforeTheEndReleasesQuantityAndCollectiveDemand() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("120.00"), 20);

        GroupBuyingAuction auction = createOpenTieredAuction(seller.getEmail(), product.getId(),
                new BigDecimal("100.00"), 2, 15, 1, 5, LocalDateTime.now().plusDays(3));

        User customer = createUser("customer", Role.ROLE_CUSTOMER);
        Address address = createAddress(customer);
        var bid = auctionParticipationService.placeBid(customer.getEmail(), auction.getId(),
                AuctionParticipationRequest.builder().quantity(4).maxUnitPrice(new BigDecimal("100.00"))
                        .addressId(address.getId()).paymentMethod(PaymentMethod.CREDIT_CARD).build());
        assertEquals(16, productRepository.findStockQuantityById(product.getId()));

        var withdrawn = auctionParticipationService.cancelParticipation(customer.getEmail(), bid.getId(), "Too slow");
        assertEquals(AuctionParticipationStatus.CANCELLED, withdrawn.getStatus());
        assertEquals(PaymentStatus.REFUNDED, withdrawn.getPaymentStatus());

        GroupBuyingAuction after = auctionRepository.findById(auction.getId()).orElseThrow();
        assertEquals(0, after.getCollectiveQuantity());
        assertEquals(0, after.getParticipantCount());
        assertEquals(20, productRepository.findStockQuantityById(product.getId()));

        assertThrows(RuntimeException.class,
                () -> auctionParticipationService.cancelParticipation(customer.getEmail(), bid.getId(), null));
    }

    @Test
    void theSellerMinimumPriceStopsTheClearingPriceFallingTooFar() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("120.00"), 20);

        GroupBuyingAuctionRequest request = GroupBuyingAuctionRequest.builder()
                .productId(product.getId())
                .startingPrice(new BigDecimal("100.00"))
                .minimumSellerUnitPrice(new BigDecimal("88.00"))
                .minimumCollectiveQuantity(2)
                .availableQuantity(15)
                .minQuantityPerCustomer(1)
                .maxQuantityPerCustomer(10)
                .startsAt(LocalDateTime.now().minusMinutes(1))
                .endsAt(LocalDateTime.now().plusDays(3))
                .pricingRule(AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS)
                .tiers(java.util.List.of(
                        GroupBuyingAuctionTierRequest.builder().minQuantity(1).unitPrice(new BigDecimal("90.00")).build(),
                        GroupBuyingAuctionTierRequest.builder().minQuantity(10).unitPrice(new BigDecimal("70.00")).build()))
                .build();
        var created = auctionService.createAuction(seller.getEmail(), request);
        auctionService.publishAuction(seller.getEmail(), created.getId());

        User customer = createUser("customer", Role.ROLE_CUSTOMER);
        Address address = createAddress(customer);
        auctionParticipationService.placeBid(customer.getEmail(), created.getId(),
                AuctionParticipationRequest.builder().quantity(10).maxUnitPrice(new BigDecimal("100.00"))
                        .addressId(address.getId()).paymentMethod(PaymentMethod.CREDIT_CARD).build());

        // The ladder says 70, but the seller's floor of 88 wins.
        auctionFinalizationService.finalizeAuction(created.getId(), seller.getEmail(), true);
        assertEquals(new BigDecimal("88.00"),
                auctionRepository.findById(created.getId()).orElseThrow().getFinalUnitPrice());
    }

    private long unused() {
        return 0;
    }
}