package com.groupmart.wholesale;

import com.groupmart.dto.wholesale.ReserveWholesaleQuantityRequest;
import com.groupmart.dto.wholesale.WholesaleReservationDto;
import com.groupmart.entity.*;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Deadline/failure path: a pool that never reaches its wholesale minimum before the deadline
 * must refund every active reservation and release its reserved inventory (CWP spec section 13).
 */
class WholesalePoolFailureFlowTest extends AbstractWholesaleIntegrationTest {

    @Test
    void expiredPoolBelowMinimumRefundsReservationsAndReleasesInventory() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        int lotCapacity = 10;
        int minimumQuantity = 8;
        Product product = createProduct(store, category, new BigDecimal("50.00"), lotCapacity);

        WholesaleOffer offer = createActiveOffer(seller.getEmail(), product.getId(),
                new BigDecimal("30.00"), minimumQuantity, lotCapacity, 1, minimumQuantity);
        WholesalePool pool = poolRepository.findByOfferIdOrderByLotNumberDesc(offer.getId()).get(0);

        User customer = createUser("customer", Role.ROLE_CUSTOMER);
        Address address = createAddress(customer);
        WholesaleReservationDto reservation = poolService.reserveQuantity(customer.getEmail(), pool.getId(),
                ReserveWholesaleQuantityRequest.builder().quantity(3).addressId(address.getId())
                        .paymentMethod(PaymentMethod.CREDIT_CARD).build());
        assertEquals(WholesaleReservationStatus.RESERVED, reservation.getStatus());
        assertEquals(0, productRepository.findStockQuantityById(product.getId()),
                "The lot's full capacity should still be reserved out of stock while it's open");

        // Force the deadline into the past, as the scheduler would find it.
        WholesalePool locked = poolRepository.findById(pool.getId()).orElseThrow();
        locked.setDeadline(LocalDateTime.now().minusMinutes(1));
        poolRepository.saveAndFlush(locked);

        poolService.failExpiredPool(pool.getId());

        WholesalePool failedPool = poolRepository.findById(pool.getId()).orElseThrow();
        assertEquals(WholesalePoolStatus.FAILED, failedPool.getStatus());
        assertEquals(WholesaleCloseCode.DEADLINE_REACHED_BELOW_MINIMUM, failedPool.getCloseCode());
        assertNotNull(failedPool.getClosedAt());

        WholesaleReservation refunded = reservationRepository.findById(reservation.getId()).orElseThrow();
        assertEquals(WholesaleReservationStatus.REFUNDED, refunded.getStatus());
        assertEquals(PaymentStatus.REFUNDED, refunded.getPaymentStatus());
        assertEquals(0, refunded.getTotalAmount().compareTo(refunded.getRefundAmount()), "Full refund");

        // None of the lot ever sold, so the entire reserved capacity must come back to stock.
        assertEquals(lotCapacity, productRepository.findStockQuantityById(product.getId()));

        assertTrue(purchaseRepository.findByPoolId(pool.getId()).isEmpty(), "A failed pool must never generate a purchase");

        // Calling it again (as the scheduler would if it raced) must be a safe no-op.
        assertDoesNotThrow(() -> poolService.failExpiredPool(pool.getId()));
        assertEquals(lotCapacity, productRepository.findStockQuantityById(product.getId()), "No double release");
    }
}
