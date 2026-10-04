package com.groupmart.collective;

import java.math.BigDecimal;

import com.groupmart.dto.reverse.ReverseGroupBuyingParticipationRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.ProductRepository;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Withdrawing demand before the purchasing condition unlocks: the quantity goes back to sellable
 * stock, the collective demand is recalculated, and the collective result stays intact afterwards.
 */
class ReverseGroupBuyingCancellationTest extends AbstractCollectiveIntegrationTest {

    @Test
    void withdrawingBeforeActivationReleasesQuantityAndRecalculatesDemand() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("100.00"), 20);

        // Target 10 units; 80% of that is 8, the "almost complete" threshold.
        ReverseGroupBuyingOffer offer = createOpenRgbOffer(seller.getEmail(), product.getId(),
                new BigDecimal("80.00"), 10, 15, 1, 12);

        User customerA = createUser("customerA", Role.ROLE_CUSTOMER);
        Address addressA = createAddress(customerA);
        User customerB = createUser("customerB", Role.ROLE_CUSTOMER);
        Address addressB = createAddress(customerB);

        rgbParticipationService.participate(customerA.getEmail(), offer.getId(),
                ReverseGroupBuyingParticipationRequest.builder().quantity(8).addressId(addressA.getId())
                        .paymentMethod(PaymentMethod.CREDIT_CARD).build());

        ReverseGroupBuyingOffer almost = rgbOfferRepository.findById(offer.getId()).orElseThrow();
        assertEquals(ReverseGroupBuyingOfferStatus.ALMOST_COMPLETE, almost.getStatus(),
                "8 of 10 units is past the 80% almost-complete threshold");
        assertEquals(8, almost.getCurrentDemand());
        assertEquals(12, productRepository.findStockQuantityById(product.getId()));

        var participationA = rgbParticipationService.getMyParticipations(customerA.getEmail()).get(0);

        // Test 8: the customer withdraws before the condition unlocked.
        var cancelled = rgbParticipationService.cancelParticipation(customerA.getEmail(), participationA.getId(), "Changed my mind");
        assertEquals(ReverseGroupBuyingParticipationStatus.CANCELLED, cancelled.getStatus());
        assertEquals(PaymentStatus.REFUNDED, cancelled.getPaymentStatus());
        assertEquals(cancelled.getTotalAmount(), cancelled.getRefundAmount(), "Full refund");
        assertNull(cancelled.getOrderId());

        // Test 9: quantity released and collective demand recalculated.
        ReverseGroupBuyingOffer after = rgbOfferRepository.findById(offer.getId()).orElseThrow();
        assertEquals(0, after.getCurrentDemand());
        assertEquals(0, after.getParticipantCount());
        assertEquals(ReverseGroupBuyingOfferStatus.OPEN, after.getStatus(),
                "A withdrawal that drops demand back below the threshold returns the offer to OPEN");
        assertEquals(20, productRepository.findStockQuantityById(product.getId()),
                "The withdrawn units must return to sellable stock");
        assertTrue(rgbCampaignRepository.findByOfferId(offer.getId()).isEmpty());

        // A second withdrawal attempt on the same participation is rejected.
        assertThrows(RuntimeException.class,
                () -> rgbParticipationService.cancelParticipation(customerA.getEmail(), participationA.getId(), null));

        // The offer can still be completed afterwards by different customers.
        rgbParticipationService.participate(customerB.getEmail(), offer.getId(),
                ReverseGroupBuyingParticipationRequest.builder().quantity(10).addressId(addressB.getId())
                        .paymentMethod(PaymentMethod.STRIPE).build());

        ReverseGroupBuyingOffer completed = rgbOfferRepository.findById(offer.getId()).orElseThrow();
        assertEquals(ReverseGroupBuyingOfferStatus.PROCESSING, completed.getStatus());
        assertEquals(1, rgbCampaignRepository.findByOfferId(offer.getId()).orElseThrow().getParticipantCount());
        assertEquals(10, productRepository.findStockQuantityById(product.getId()));
    }

    @Test
    void aWithdrawalAfterActivationIsRejectedAndTheOrderRulesTakeOver() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("100.00"), 10);

        ReverseGroupBuyingOffer offer = createOpenRgbOffer(seller.getEmail(), product.getId(),
                new BigDecimal("80.00"), 2, 8, 1, 8);

        User customer = createUser("customer", Role.ROLE_CUSTOMER);
        Address address = createAddress(customer);
        var participation = rgbParticipationService.participate(customer.getEmail(), offer.getId(),
                ReverseGroupBuyingParticipationRequest.builder().quantity(2).addressId(address.getId())
                        .paymentMethod(PaymentMethod.CREDIT_CARD).build());

        // The participation already became its own order, so the collective result is frozen.
        assertEquals(ReverseGroupBuyingOfferStatus.PROCESSING,
                rgbOfferRepository.findById(offer.getId()).orElseThrow().getStatus());

        assertThrows(RuntimeException.class, () -> rgbParticipationService.cancelParticipation(
                customer.getEmail(), participation.getId(), "too late"));

        ReverseGroupBuyingCampaign campaign = rgbCampaignRepository.findByOfferId(offer.getId()).orElseThrow();
        assertEquals(2, campaign.getTotalConfirmedQuantity(), "The campaign must not be corrupted by a late attempt");
        assertEquals(8, productRepository.findStockQuantityById(product.getId()));
    }

    @Test
    void aSellerClosingAnOpenOfferRefundsEveryoneAndReleasesStock() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("100.00"), 10);

        ReverseGroupBuyingOffer offer = createOpenRgbOffer(seller.getEmail(), product.getId(),
                new BigDecimal("80.00"), 9, 10, 1, 5);

        User customer = createUser("customer", Role.ROLE_CUSTOMER);
        Address address = createAddress(customer);
        rgbParticipationService.participate(customer.getEmail(), offer.getId(),
                ReverseGroupBuyingParticipationRequest.builder().quantity(4).addressId(address.getId())
                        .paymentMethod(PaymentMethod.CREDIT_CARD).build());
        assertEquals(6, productRepository.findStockQuantityById(product.getId()));

        var closed = rgbOfferService.closeOffer(seller.getEmail(), offer.getId(), "Not worth running");
        assertEquals(ReverseGroupBuyingOfferStatus.CLOSED, closed.getStatus());
        assertEquals(ReverseGroupBuyingCloseCode.CLOSED_EARLY_BY_SELLER, closed.getCloseCode());
        assertEquals(0, closed.getCurrentDemand());

        var refunded = rgbParticipationService.getMyParticipations(customer.getEmail()).get(0);
        assertEquals(ReverseGroupBuyingParticipationStatus.REFUNDED, refunded.getStatus());
        assertEquals(PaymentStatus.REFUNDED, refunded.getPaymentStatus());
        assertEquals(10, productRepository.findStockQuantityById(product.getId()),
                "All reserved units must return to sellable stock");

        // A closed offer accepts no more demand and cannot be closed twice.
        assertThrows(RuntimeException.class, () -> rgbOfferService.closeOffer(seller.getEmail(), offer.getId(), null));
        assertThrows(RuntimeException.class, () -> rgbParticipationService.participate(customer.getEmail(), offer.getId(),
                ReverseGroupBuyingParticipationRequest.builder().quantity(1).addressId(address.getId())
                        .paymentMethod(PaymentMethod.CREDIT_CARD).build()));
    }

    @Test
    void fulfillmentAndCompletionAdvanceTheCampaignLifecycle() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("100.00"), 10);

        ReverseGroupBuyingOffer offer = createOpenRgbOffer(seller.getEmail(), product.getId(),
                new BigDecimal("80.00"), 2, 8, 1, 8);

        User customer = createUser("customer", Role.ROLE_CUSTOMER);
        Address address = createAddress(customer);
        rgbParticipationService.participate(customer.getEmail(), offer.getId(),
                ReverseGroupBuyingParticipationRequest.builder().quantity(2).addressId(address.getId())
                        .paymentMethod(PaymentMethod.CREDIT_CARD).build());

        assertEquals(ReverseGroupBuyingOfferStatus.FULFILLMENT,
                rgbOfferService.startFulfillment(seller.getEmail(), offer.getId()).getStatus());
        assertEquals(ReverseGroupBuyingOfferStatus.COMPLETED,
                rgbOfferService.completeOffer(seller.getEmail(), offer.getId()).getStatus());
        assertEquals(new BigDecimal("160.00"),
                orderRepository.findByOrderByCreatedAtDesc().get(0).getTotalAmount());
    }
}
