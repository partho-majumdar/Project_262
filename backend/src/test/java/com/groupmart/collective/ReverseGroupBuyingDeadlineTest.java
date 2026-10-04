package com.groupmart.collective;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.groupmart.dto.reverse.ReverseGroupBuyingParticipationRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.ProductRepository;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Server-side deadline handling: the backend, not the frontend, decides what happens when a Reverse
 * Group Buying participation deadline passes.
 */
class ReverseGroupBuyingDeadlineTest extends AbstractCollectiveIntegrationTest {

    @Test
    void deadlineWithoutTargetFailsTheOfferRefundsEveryoneAndReleasesStock() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("100.00"), 10);

        ReverseGroupBuyingOffer offer = createOpenRgbOffer(seller.getEmail(), product.getId(),
                new BigDecimal("80.00"), 8, 10, 1, 5);

        User customer = createUser("customer", Role.ROLE_CUSTOMER);
        Address address = createAddress(customer);
        var participation = rgbParticipationService.participate(customer.getEmail(), offer.getId(),
                ReverseGroupBuyingParticipationRequest.builder().quantity(3).addressId(address.getId())
                        .paymentMethod(PaymentMethod.CREDIT_CARD).build());
        assertEquals(7, productRepository.findStockQuantityById(product.getId()));

        // Force the deadline into the past, exactly as the scheduler would find it.
        ReverseGroupBuyingOffer stored = rgbOfferRepository.findById(offer.getId()).orElseThrow();
        stored.setParticipationDeadline(LocalDateTime.now().minusMinutes(1));
        rgbOfferRepository.saveAndFlush(stored);

        // Test 10: the deadline expires without the target condition being achieved.
        rgbOfferService.expireOfferIfDue(offer.getId(), ReverseGroupBuyingCloseCode.DEADLINE_REACHED_BELOW_TARGET);

        ReverseGroupBuyingOffer failed = rgbOfferRepository.findById(offer.getId()).orElseThrow();
        assertEquals(ReverseGroupBuyingOfferStatus.FAILED, failed.getStatus());
        assertEquals(ReverseGroupBuyingCloseCode.DEADLINE_REACHED_BELOW_TARGET, failed.getCloseCode());
        assertNotNull(failed.getClosedAt());
        assertEquals(0, failed.getCurrentDemand());

        ReverseGroupBuyingParticipation refunded = rgbParticipationRepository.findById(participation.getId()).orElseThrow();
        assertEquals(ReverseGroupBuyingParticipationStatus.REFUNDED, refunded.getStatus());
        assertEquals(PaymentStatus.REFUNDED, refunded.getPaymentStatus());
        assertEquals(0, refunded.getTotalAmount().compareTo(refunded.getRefundAmount()), "Full refund");
        assertNull(refunded.getOrder());

        assertEquals(10, productRepository.findStockQuantityById(product.getId()),
                "No unit ever sold, so the whole reservation must come back");
        assertTrue(rgbCampaignRepository.findByOfferId(offer.getId()).isEmpty(),
                "A failed offer must never generate a campaign or orders");

        // Re-running the sweep (or a late scheduler tick) must be a safe no-op, with no double release.
        assertDoesNotThrow(() -> rgbOfferService.expireOfferIfDue(offer.getId(),
                ReverseGroupBuyingCloseCode.DEADLINE_REACHED_BELOW_TARGET));
        assertEquals(10, productRepository.findStockQuantityById(product.getId()));
    }

    @Test
    void aParticipationArrivingAfterTheDeadlineIsRejected() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("100.00"), 10);

        ReverseGroupBuyingOffer offer = createOpenRgbOffer(seller.getEmail(), product.getId(),
                new BigDecimal("80.00"), 8, 10, 1, 5);

        ReverseGroupBuyingOffer stored = rgbOfferRepository.findById(offer.getId()).orElseThrow();
        stored.setParticipationDeadline(LocalDateTime.now().minusSeconds(5));
        rgbOfferRepository.saveAndFlush(stored);

        User customer = createUser("customer", Role.ROLE_CUSTOMER);
        Address address = createAddress(customer);

        assertThrows(RuntimeException.class, () -> rgbParticipationService.participate(customer.getEmail(), offer.getId(),
                ReverseGroupBuyingParticipationRequest.builder().quantity(1).addressId(address.getId())
                        .paymentMethod(PaymentMethod.CREDIT_CARD).build()),
                "The server rejects a participation that arrives after the deadline even if the UI still allows it");

        assertEquals(10, productRepository.findStockQuantityById(product.getId()));
    }

    @Test
    void aMetTargetIsNeverTurnedIntoAFailureByTheDeadlineSweep() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("100.00"), 10);

        ReverseGroupBuyingOffer offer = createOpenRgbOffer(seller.getEmail(), product.getId(),
                new BigDecimal("80.00"), 2, 10, 1, 5);

        User customer = createUser("customer", Role.ROLE_CUSTOMER);
        Address address = createAddress(customer);
        rgbParticipationService.participate(customer.getEmail(), offer.getId(),
                ReverseGroupBuyingParticipationRequest.builder().quantity(2).addressId(address.getId())
                        .paymentMethod(PaymentMethod.CREDIT_CARD).build());

        // Activation already happened inline with the participation, so nothing is left to unlock.
        assertEquals(ReverseGroupBuyingOfferStatus.PROCESSING,
                rgbOfferRepository.findById(offer.getId()).orElseThrow().getStatus());
        assertDoesNotThrow(() -> rgbOfferService.expireOfferIfDue(offer.getId(),
                ReverseGroupBuyingCloseCode.DEADLINE_REACHED_BELOW_TARGET));
        assertEquals(ReverseGroupBuyingOfferStatus.PROCESSING,
                rgbOfferRepository.findById(offer.getId()).orElseThrow().getStatus(),
                "A met target must never be turned into a failure by the deadline sweep");
        assertEquals(new BigDecimal("160.00"), orderRepository.findByOrderByCreatedAtDesc().get(0).getTotalAmount());
    }
}
