package com.groupmart.wholesale;

import com.groupmart.dto.wholesale.ReserveWholesaleQuantityRequest;
import com.groupmart.dto.wholesale.WholesaleReservationDto;
import com.groupmart.entity.*;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * End-to-end happy path: offer creation -> approval -> multiple customer reservations ->
 * pool completion -> individual orders/payments generated -> leftover lot capacity released
 * (CWP spec sections 3, 6-9, 14 and 23).
 */
class WholesalePoolCompletionFlowTest extends AbstractWholesaleIntegrationTest {

    @Test
    void poolCompletionGeneratesIndividualOrdersAndReleasesLeftoverInventory() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        int lotCapacity = 8;
        int minimumQuantity = 5;
        Product product = createProduct(store, category, new BigDecimal("100.00"), lotCapacity);

        WholesaleOffer offer = createActiveOffer(seller.getEmail(), product.getId(),
                new BigDecimal("60.00"), minimumQuantity, lotCapacity, 1, minimumQuantity);
        WholesalePool openedPool = poolRepository.findByOfferIdOrderByLotNumberDesc(offer.getId()).get(0);
        assertEquals(WholesalePoolStatus.OPEN, openedPool.getStatus());
        assertEquals(0, productRepository.findStockQuantityById(product.getId()),
                "Opening the lot must reserve its full capacity out of product stock");

        User customerA = createUser("customerA", Role.ROLE_CUSTOMER);
        Address addressA = createAddress(customerA);
        User customerB = createUser("customerB", Role.ROLE_CUSTOMER);
        Address addressB = createAddress(customerB);

        WholesaleReservationDto reservationA = poolService.reserveQuantity(customerA.getEmail(), openedPool.getId(),
                ReserveWholesaleQuantityRequest.builder().quantity(3).addressId(addressA.getId())
                        .paymentMethod(PaymentMethod.CREDIT_CARD).build());
        assertEquals(WholesaleReservationStatus.RESERVED, reservationA.getStatus());

        // Below the minimum: pool must still be open, no purchase yet.
        WholesalePool midPool = poolRepository.findById(openedPool.getId()).orElseThrow();
        assertTrue(midPool.getStatus().acceptsReservations());
        assertTrue(purchaseRepository.findByPoolId(openedPool.getId()).isEmpty());

        WholesaleReservationDto reservationB = poolService.reserveQuantity(customerB.getEmail(), openedPool.getId(),
                ReserveWholesaleQuantityRequest.builder().quantity(2).addressId(addressB.getId())
                        .paymentMethod(PaymentMethod.STRIPE).build());

        // Reaching the minimum (5) must complete the pool and generate one order per reservation.
        WholesalePool completedPool = poolRepository.findById(openedPool.getId()).orElseThrow();
        assertEquals(WholesalePoolStatus.PROCESSING, completedPool.getStatus());
        assertEquals(minimumQuantity, completedPool.getPooledQuantity());

        WholesalePurchase purchase = purchaseRepository.findByPoolId(openedPool.getId()).orElseThrow();
        assertEquals(minimumQuantity, purchase.getTotalConfirmedQuantity());
        assertEquals(2, purchase.getParticipantCount());

        WholesaleReservation savedA = reservationRepository.findById(reservationA.getId()).orElseThrow();
        WholesaleReservation savedB = reservationRepository.findById(reservationB.getId()).orElseThrow();
        assertEquals(WholesaleReservationStatus.CONVERTED, savedA.getStatus());
        assertEquals(WholesaleReservationStatus.CONVERTED, savedB.getStatus());
        assertNotNull(savedA.getOrder());
        assertNotNull(savedB.getOrder());

        Order orderA = orderRepository.findById(savedA.getOrder().getId()).orElseThrow();
        assertEquals(OrderType.WHOLESALE, orderA.getOrderType());
        assertEquals(purchase.getId(), orderA.getWholesalePurchaseId());
        assertEquals(0, new BigDecimal("180.00").compareTo(orderA.getTotalAmount()), "3 units * 60 = 180");
        assertEquals(1, orderA.getItems().size());
        assertFalse(paymentTransactionRepository.findByOrderIdOrderByCreatedAtDesc(orderA.getId()).isEmpty());

        Order orderB = orderRepository.findById(savedB.getOrder().getId()).orElseThrow();
        assertEquals(0, new BigDecimal("120.00").compareTo(orderB.getTotalAmount()), "2 units * 60 = 120");

        // Leftover lot capacity (8 - 5 = 3) must return to sellable stock, not stay stranded.
        int leftover = lotCapacity - minimumQuantity;
        assertEquals(leftover, productRepository.findStockQuantityById(product.getId()));
    }
}
