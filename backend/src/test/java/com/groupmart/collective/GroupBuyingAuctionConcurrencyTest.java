package com.groupmart.collective;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import com.groupmart.dto.auction.AuctionParticipationRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.ProductRepository;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Auction concurrency: many customers bid at the same instant and a finalization can race that storm.
 * The collective quantity, the available quantity and the sellable stock must all stay consistent, and
 * the auction must settle exactly once.
 */
class GroupBuyingAuctionConcurrencyTest extends AbstractCollectiveIntegrationTest {

    private static final int AVAILABLE = 10;
    private static final int CONTENDERS = 20;

    @Test
    void concurrentBidsNeverExceedAvailableQuantity() throws Exception {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("120.00"), AVAILABLE);

        GroupBuyingAuction auction = createOpenTieredAuction(seller.getEmail(), product.getId(),
                new BigDecimal("100.00"), 1, AVAILABLE, 1, 1, LocalDateTime.now().plusDays(2));

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
                    auctionParticipationService.placeBid(c.email(), auction.getId(),
                            AuctionParticipationRequest.builder()
                                    .quantity(1).maxUnitPrice(new BigDecimal("100.00"))
                                    .addressId(c.addressId()).paymentMethod(PaymentMethod.CREDIT_CARD).build());
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

        assertEquals(AVAILABLE, succeeded.get(), "Exactly the available quantity may be bid");
        assertEquals(CONTENDERS - AVAILABLE, failed.get());

        GroupBuyingAuction finalAuction = auctionRepository.findById(auction.getId()).orElseThrow();
        assertEquals(AVAILABLE, finalAuction.getCollectiveQuantity());
        assertTrue(finalAuction.getCollectiveQuantity() <= finalAuction.getAvailableQuantity());
        assertEquals(0, productRepository.findStockQuantityById(product.getId()));
        assertEquals(AVAILABLE,
                auctionParticipationRepository
                        .findByAuctionIdAndStatus(auction.getId(), AuctionParticipationStatus.BID_PLACED).size());
    }

    @Test
    void concurrentFinalizationAttemptsStillProduceExactlyOneResult() throws Exception {
        User seller = createUser("seller", Role.ROLE_SELLER);
        SellerStore store = createSellerStore(seller);
        Category category = createCategory();
        Product product = createProduct(store, category, new BigDecimal("120.00"), 20);

        GroupBuyingAuction auction = createOpenTieredAuction(seller.getEmail(), product.getId(),
                new BigDecimal("100.00"), 1, 15, 1, 5, LocalDateTime.now().plusDays(2));

        User customer = createUser("customer", Role.ROLE_CUSTOMER);
        Address address = createAddress(customer);
        auctionParticipationService.placeBid(customer.getEmail(), auction.getId(),
                AuctionParticipationRequest.builder().quantity(3).maxUnitPrice(new BigDecimal("100.00"))
                        .addressId(address.getId()).paymentMethod(PaymentMethod.CREDIT_CARD).build());

        // The window has now closed, so both the seller's button and the deadline sweep are legitimate
        // finalizers racing each other.
        GroupBuyingAuction stored = auctionRepository.findById(auction.getId()).orElseThrow();
        stored.setEndsAt(LocalDateTime.now().minusSeconds(30));
        auctionRepository.saveAndFlush(stored);

        // Five finalization attempts, as a seller clicking twice while the deadline sweep fires.
        int racers = 5;
        ExecutorService pool = Executors.newFixedThreadPool(racers);
        CyclicBarrier startingLine = new CyclicBarrier(racers);
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < racers; i++) {
            final boolean viaSeller = i % 2 == 0;
            futures.add(pool.submit(() -> {
                try {
                    startingLine.await(10, TimeUnit.SECONDS);
                } catch (Exception ex) {
                    Thread.currentThread().interrupt();
                    return;
                }
                try {
                    auctionFinalizationService.finalizeAuction(auction.getId(), seller.getEmail(), viaSeller);
                } catch (Exception ignored) {
                    // Losing the race is fine; producing a second result is not.
                }
            }));
        }
        for (Future<?> f : futures) {
            f.get(60, TimeUnit.SECONDS);
        }
        pool.shutdown();

        assertEquals(1L, auctionResultRepository.count(), "Exactly one locked result, no matter how many racers");
        GroupBuyingAuction settled = auctionRepository.findById(auction.getId()).orElseThrow();
        assertEquals(GroupBuyingAuctionStatus.COMPLETED, settled.getStatus());
        assertEquals(new BigDecimal("95.00"), settled.getFinalUnitPrice(), "3 units sits in the 1-4 band");

        assertEquals(1, orderRepository.findByOrderTypeOrderByCreatedAtDesc(OrderType.GROUP_BUYING_AUCTION).size(),
                "The winner must get exactly one order, however many times the auction was finalized");
        assertEquals(17, productRepository.findStockQuantityById(product.getId()));
    }
}
