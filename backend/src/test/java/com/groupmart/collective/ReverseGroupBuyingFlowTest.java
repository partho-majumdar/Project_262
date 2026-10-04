package com.groupmart.collective;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.groupmart.dto.reverse.ReverseGroupBuyingOfferDto;
import com.groupmart.dto.reverse.ReverseGroupBuyingParticipationDto;
import com.groupmart.dto.reverse.ReverseGroupBuyingParticipationRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.ProductRepository;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Reverse Group Buying happy path: a seller defines a target condition, two customers contribute
 * demand independently, the condition is reached, the purchasing condition is unlocked and each
 * customer gets their own order with the right quantity and price.
 */
class ReverseGroupBuyingFlowTest extends AbstractCollectiveIntegrationTest {

    @Test
    void targetReachedUnlocksTheConditionAndGeneratesOneOrderPerParticipant() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("100.00"), 20);

        // Test 1: the seller creates and publishes the offer.
        ReverseGroupBuyingOffer offer = createOpenRgbOffer(seller.getEmail(), product.getId(),
                new BigDecimal("80.00"), 5, 10, 1, 5);
        assertEquals(ReverseGroupBuyingOfferStatus.OPEN, offer.getStatus());
        assertEquals(ReverseTargetType.TARGET_QUANTITY, offer.getTargetType());
        assertEquals(0, offer.getCurrentDemand());
        assertEquals(20, productRepository.findStockQuantityById(product.getId()),
                "Publishing an offer must not reserve stock up front; each participation reserves its own units");

        User customerA = createUser("customerA", Role.ROLE_CUSTOMER);
        Address addressA = createAddress(customerA);
        User customerB = createUser("customerB", Role.ROLE_CUSTOMER);
        Address addressB = createAddress(customerB);

        // Test 2 + 3: two customers participate independently.
        ReverseGroupBuyingParticipationDto a = rgbParticipationService.participate(customerA.getEmail(), offer.getId(),
                ReverseGroupBuyingParticipationRequest.builder().quantity(2).addressId(addressA.getId())
                        .paymentMethod(PaymentMethod.CREDIT_CARD).build());
        assertEquals(ReverseGroupBuyingParticipationStatus.PARTICIPATING, a.getStatus());
        assertEquals(new BigDecimal("160.00"), a.getTotalAmount());

        ReverseGroupBuyingOffer midFlight = rgbOfferRepository.findById(offer.getId()).orElseThrow();
        assertEquals(2, midFlight.getCurrentDemand());
        assertEquals(1, midFlight.getParticipantCount());
        assertEquals(18, productRepository.findStockQuantityById(product.getId()));
        assertTrue(rgbCampaignRepository.findByOfferId(offer.getId()).isEmpty(), "No campaign before the target is met");

        ReverseGroupBuyingParticipationDto b = rgbParticipationService.participate(customerB.getEmail(), offer.getId(),
                ReverseGroupBuyingParticipationRequest.builder().quantity(3).addressId(addressB.getId())
                        .paymentMethod(PaymentMethod.STRIPE).build());

        // Test 4 + 5: the target condition was reached and the purchasing condition unlocked.
        ReverseGroupBuyingOffer activated = rgbOfferRepository.findById(offer.getId()).orElseThrow();
        assertEquals(5, activated.getCurrentDemand(), "Collective demand accumulates across participants");
        assertEquals(ReverseGroupBuyingOfferStatus.PROCESSING, activated.getStatus());
        assertNotNull(activated.getActivatedAt());
        assertEquals(2, activated.getParticipantCount());

        var campaign = rgbCampaignRepository.findByOfferId(offer.getId()).orElseThrow();
        assertEquals(5, campaign.getTotalConfirmedQuantity());
        assertEquals(2, campaign.getParticipantCount());
        assertEquals(new BigDecimal("80.00"), campaign.getUnlockedUnitPrice());

        // Test 6: individual orders, one per participant - never one shared customer order.
        ReverseGroupBuyingParticipation savedA = rgbParticipationRepository.findById(a.getId()).orElseThrow();
        ReverseGroupBuyingParticipation savedB = rgbParticipationRepository.findById(b.getId()).orElseThrow();
        assertEquals(ReverseGroupBuyingParticipationStatus.CONVERTED, savedA.getStatus());
        assertEquals(ReverseGroupBuyingParticipationStatus.CONVERTED, savedB.getStatus());
        assertNotEquals(savedA.getOrder().getId(), savedB.getOrder().getId());

        // Test 7: each customer gets their own quantity, price, order and payment.
        Order orderA = orderRepository.findById(savedA.getOrder().getId()).orElseThrow();
        Order orderB = orderRepository.findById(savedB.getOrder().getId()).orElseThrow();

        assertEquals(OrderType.REVERSE_GROUP_BUYING, orderA.getOrderType());
        assertEquals(OrderType.REVERSE_GROUP_BUYING, orderB.getOrderType());
        assertEquals(campaign.getId(), orderA.getReverseGroupBuyingCampaignId());
        assertEquals(campaign.getId(), orderB.getReverseGroupBuyingCampaignId());
        assertNull(orderA.getWholesalePurchaseId(), "A reverse group buying order must not be linked to a CWP purchase");
        assertNull(orderA.getGroupBuyingAuctionId());

        assertEquals(new BigDecimal("160.00"), orderA.getTotalAmount(), "2 units x 80");
        assertEquals(new BigDecimal("240.00"), orderB.getTotalAmount(), "3 units x 80");
        assertEquals(1, orderA.getItems().size());
        assertEquals(2, orderA.getItems().get(0).getQuantity());
        assertEquals(new BigDecimal("80.00"), orderA.getItems().get(0).getUnitPrice());
        assertEquals(customerA.getId(), orderA.getUser().getId());
        assertEquals(customerB.getId(), orderB.getUser().getId());

        assertFalse(paymentTransactionRepository.findByOrderIdOrderByCreatedAtDesc(orderA.getId()).isEmpty());
        assertFalse(paymentTransactionRepository.findByOrderIdOrderByCreatedAtDesc(orderB.getId()).isEmpty());

        // The units stayed sold: only what the participants claimed left sellable stock.
        assertEquals(15, productRepository.findStockQuantityById(product.getId()));
    }

    @Test
    void everyCustomerKeepsOwnAddressPaymentAndDelivery() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("50.00"), 10);

        ReverseGroupBuyingOffer offer = createOpenRgbOffer(seller.getEmail(), product.getId(),
                new BigDecimal("40.00"), 2, 6, 1, 2);

        User customerA = createUser("customerA", Role.ROLE_CUSTOMER);
        Address addressA = createAddress(customerA);
        User customerB = createUser("customerB", Role.ROLE_CUSTOMER);
        Address addressB = createAddress(customerB);
        addressB.setStreetAddress("999 Other Road");
        addressRepository.save(addressB);

        rgbParticipationService.participate(customerA.getEmail(), offer.getId(),
                ReverseGroupBuyingParticipationRequest.builder().quantity(1).addressId(addressA.getId())
                        .paymentMethod(PaymentMethod.PAYPAL).build());
        rgbParticipationService.participate(customerB.getEmail(), offer.getId(),
                ReverseGroupBuyingParticipationRequest.builder().quantity(1).addressId(addressB.getId())
                        .paymentMethod(PaymentMethod.DEBIT_CARD).build());

        // Look each order up through its own participation, never by list position.
        Order orderA = orderRepository.findById(
                rgbParticipationRepository.findByOfferIdAndStatus(offer.getId(),
                        ReverseGroupBuyingParticipationStatus.CONVERTED).stream()
                        .filter(p -> p.getUser().getId().equals(customerA.getId())).findFirst().orElseThrow()
                        .getOrder().getId()).orElseThrow();
        Order orderB = orderRepository.findById(
                rgbParticipationRepository.findByOfferIdAndStatus(offer.getId(),
                        ReverseGroupBuyingParticipationStatus.CONVERTED).stream()
                        .filter(p -> p.getUser().getId().equals(customerB.getId())).findFirst().orElseThrow()
                        .getOrder().getId()).orElseThrow();

        assertEquals("123 Test Street", orderA.getShippingAddressLine1());
        assertEquals("999 Other Road", orderB.getShippingAddressLine1());
        assertEquals(PaymentMethod.PAYPAL, orderA.getPaymentMethod());
        assertEquals(PaymentMethod.DEBIT_CARD, orderB.getPaymentMethod());
        assertNotNull(orderA.getEstimatedDeliveryAt(), "Each order gets its own delivery estimate");
    }

    @Test
    void participationCannotOversellTheProductStock() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        // Only five units exist, and the offer is configured to use all of them.
        Product product = createProduct(store, category, new BigDecimal("30.00"), 5);

        ReverseGroupBuyingOffer offer = createOpenRgbOffer(seller.getEmail(), product.getId(),
                new BigDecimal("20.00"), 5, 5, 1, 5);

        User customerA = createUser("customerA", Role.ROLE_CUSTOMER);
        Address addressA = createAddress(customerA);
        User customerB = createUser("customerB", Role.ROLE_CUSTOMER);
        Address addressB = createAddress(customerB);

        rgbParticipationService.participate(customerA.getEmail(), offer.getId(),
                ReverseGroupBuyingParticipationRequest.builder().quantity(4).addressId(addressA.getId())
                        .paymentMethod(PaymentMethod.CREDIT_CARD).build());
        assertEquals(1, productRepository.findStockQuantityById(product.getId()));

        // Only one unit is physically left, so nobody can claim more than that.
        assertThrows(RuntimeException.class, () -> rgbParticipationService.participate(customerB.getEmail(), offer.getId(),
                ReverseGroupBuyingParticipationRequest.builder().quantity(4).addressId(addressB.getId())
                        .paymentMethod(PaymentMethod.CREDIT_CARD).build()));

        assertEquals(1, productRepository.findStockQuantityById(product.getId()), "Stock must not go negative");
        assertEquals(4, rgbOfferRepository.findById(offer.getId()).orElseThrow().getCurrentDemand(),
                "A rejected participation must not be counted in the collective demand");
    }

    @Test
    void anUnmetTargetIsNotActivatedAndTheOfferStaysOpen() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("30.00"), 10);

        ReverseGroupBuyingOffer offer = createOpenRgbOffer(seller.getEmail(), product.getId(),
                new BigDecimal("20.00"), 6, 10, 1, 6);

        User customer = createUser("customer", Role.ROLE_CUSTOMER);
        Address address = createAddress(customer);
        rgbParticipationService.participate(customer.getEmail(), offer.getId(),
                ReverseGroupBuyingParticipationRequest.builder().quantity(3).addressId(address.getId())
                        .paymentMethod(PaymentMethod.CREDIT_CARD).build());

        ReverseGroupBuyingOfferDto view = rgbOfferService.getPublicOffer(offer.getId());
        assertEquals(ReverseGroupBuyingOfferStatus.OPEN, view.getStatus());
        assertFalse(view.isTargetReached());
        assertEquals(3, view.getRemainingToTarget());
        assertEquals(7, view.getRemainingDemand());
        assertEquals(50, view.getTargetProgressPercent());
        assertTrue(rgbCampaignRepository.findByOfferId(offer.getId()).isEmpty());
    }
}
