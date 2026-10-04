package com.groupmart.wholesale;

import com.groupmart.dto.wholesale.ReserveWholesaleQuantityRequest;
import com.groupmart.entity.*;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Proves the CWP spec section 15 requirement: oversubscription protection must hold at the
 * database/transaction level, not only in frontend validation. Twenty customers race to reserve
 * the last ten units of a pool at the same instant; exactly ten may win.
 */
class WholesalePoolConcurrencyTest extends AbstractWholesaleIntegrationTest {

    private static final int LOT_CAPACITY = 10;
    private static final int CONTENDERS = 20;

    @Test
    void concurrentReservationsNeverExceedLotCapacity() throws Exception {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("100.00"), LOT_CAPACITY);

        WholesaleOffer offer = createActiveOffer(seller.getEmail(), product.getId(),
                new BigDecimal("60.00"), LOT_CAPACITY, LOT_CAPACITY, 1, 1);
        WholesalePool pool = poolRepository.findByOfferIdOrderByLotNumberDesc(offer.getId()).get(0);

        // Each contender is its own customer with its own address, reserving exactly 1 unit.
        record Contender(User user, java.util.UUID addressId) {}
        List<Contender> contenders = new java.util.ArrayList<>();
        for (int i = 0; i < CONTENDERS; i++) {
            User customer = createUser("customer", Role.ROLE_CUSTOMER);
            Address address = createAddress(customer);
            contenders.add(new Contender(customer, address.getId()));
        }

        ExecutorService pool2 = Executors.newFixedThreadPool(CONTENDERS);
        CyclicBarrier startingLine = new CyclicBarrier(CONTENDERS);
        AtomicInteger succeeded = new AtomicInteger();
        AtomicInteger failed = new AtomicInteger();
        List<Future<?>> futures = new java.util.ArrayList<>();

        for (Contender c : contenders) {
            futures.add(pool2.submit(() -> {
                try {
                    startingLine.await(10, TimeUnit.SECONDS);
                    poolService.reserveQuantity(c.user().getEmail(), pool.getId(), ReserveWholesaleQuantityRequest.builder()
                            .quantity(1)
                            .addressId(c.addressId())
                            .paymentMethod(PaymentMethod.CREDIT_CARD)
                            .build());
                    succeeded.incrementAndGet();
                } catch (Exception ex) {
                    failed.incrementAndGet();
                }
            }));
        }
        for (Future<?> f : futures) {
            f.get(30, TimeUnit.SECONDS);
        }
        pool2.shutdown();

        assertEquals(LOT_CAPACITY, succeeded.get(), "Exactly lotCapacity reservations should win the race");
        assertEquals(CONTENDERS - LOT_CAPACITY, failed.get(), "The rest must be rejected, never silently overbooked");

        WholesalePool finalPool = poolRepository.findById(pool.getId()).orElseThrow();
        assertEquals(LOT_CAPACITY, finalPool.getPooledQuantity(), "pooledQuantity must never exceed lotCapacity");
        assertTrue(finalPool.getPooledQuantity() <= finalPool.getLotCapacity(), "Never oversold");

        long activeReservations = reservationRepository.findByPoolIdAndStatus(pool.getId(), WholesaleReservationStatus.CONVERTED).size();
        assertEquals(LOT_CAPACITY, activeReservations, "Every winning reservation should have converted to an order");
    }
}
