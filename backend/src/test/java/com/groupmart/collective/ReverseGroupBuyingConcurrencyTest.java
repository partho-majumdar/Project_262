package com.groupmart.collective;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import com.groupmart.dto.reverse.ReverseGroupBuyingParticipationRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.ProductRepository;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Inventory protection under concurrency. Twenty customers race for the last ten units of a Reverse
 * Group Buying offer at the same instant; exactly ten may win and the offer's collective demand can
 * never exceed its available quantity.
 * <p>
 * This is the guarantee that matters most: the offer row is locked and stock is taken with the
 * shared atomic decrement, so the protection is in the database, not in the frontend.
 */
class ReverseGroupBuyingConcurrencyTest extends AbstractCollectiveIntegrationTest {

    private static final int AVAILABLE = 10;
    private static final int CONTENDERS = 20;

    @Test
    void concurrentParticipationsNeverExceedAvailableQuantityOrStock() throws Exception {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("100.00"), AVAILABLE);

        // Target equals the available quantity, so the offer activates exactly when it is full.
        ReverseGroupBuyingOffer offer = createOpenRgbOffer(seller.getEmail(), product.getId(),
                new BigDecimal("80.00"), AVAILABLE, AVAILABLE, 1, 1);

        record Contender(String email, UUID addressId) {}
        List<Contender> contenders = new ArrayList<>();
        for (int i = 0; i < CONTENDERS; i++) {
            User customer = createUser("customer", Role.ROLE_CUSTOMER);
            Address address = createAddress(customer);
            contenders.add(new Contender(customer.getEmail(), address.getId()));
        }

        ExecutorService pool = Executors.newFixedThreadPool(CONTENDERS);
        CyclicBarrier startingLine = new CyclicBarrier(CONTENDERS);
        AtomicInteger succeeded = new AtomicInteger();
        AtomicInteger failed = new AtomicInteger();
        List<Future<?>> futures = new ArrayList<>();

        for (Contender c : contenders) {
            futures.add(pool.submit(() -> {
                try {
                    startingLine.await(10, TimeUnit.SECONDS);
                    rgbParticipationService.participate(c.email(), offer.getId(),
                            ReverseGroupBuyingParticipationRequest.builder()
                                    .quantity(1).addressId(c.addressId())
                                    .paymentMethod(PaymentMethod.CREDIT_CARD).build());
                    succeeded.incrementAndGet();
                } catch (Exception ex) {
                    failed.incrementAndGet();
                }
            }));
        }
        for (Future<?> f : futures) {
            f.get(60, TimeUnit.SECONDS);
        }
        pool.shutdown();

        assertEquals(AVAILABLE, succeeded.get(), "Exactly the available quantity may win the race");
        assertEquals(CONTENDERS - AVAILABLE, failed.get(), "The rest must be rejected, never silently overbooked");

        ReverseGroupBuyingOffer finalOffer = rgbOfferRepository.findById(offer.getId()).orElseThrow();
        assertEquals(AVAILABLE, finalOffer.getCurrentDemand());
        assertTrue(finalOffer.getCurrentDemand() <= finalOffer.getAvailableQuantity(), "Never oversold");
        assertEquals(0, productRepository.findStockQuantityById(product.getId()));
        assertTrue(productRepository.findStockQuantityById(product.getId()) >= 0, "Stock can never go negative");

        // Every winning participation became its own order at the unlocked price.
        List<ReverseGroupBuyingParticipation> winners = rgbParticipationRepository
                .findByOfferIdAndStatus(offer.getId(), ReverseGroupBuyingParticipationStatus.CONVERTED);
        assertEquals(AVAILABLE, winners.size());
        var campaign = rgbCampaignRepository.findByOfferId(offer.getId()).orElseThrow();
        assertEquals(AVAILABLE, campaign.getTotalConfirmedQuantity());
        for (ReverseGroupBuyingParticipation winner : winners) {
            Order order = orderRepository.findById(winner.getOrder().getId()).orElseThrow();
            assertEquals(new BigDecimal("80.00"), order.getTotalAmount(), "1 unit x 80");
            assertEquals(campaign.getId(), order.getReverseGroupBuyingCampaignId());
        }
        assertEquals(AVAILABLE, orderRepository.findByOrderTypeOrderByCreatedAtDesc(OrderType.REVERSE_GROUP_BUYING).size());
    }
}
