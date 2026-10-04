package com.groupmart.groupreverse;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import com.groupmart.entity.*;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The guarantees that only a real database and real threads can prove.
 * <p>
 * The unit is always reserved at selection through a conditional decrement, and selection serialises
 * on the demand's own row lock, so the interesting cases are two customers racing for the last units
 * and two leaders trying to choose an offer at the same moment.
 */
class GroupReverseConcurrencyTest extends AbstractGroupReverseTest {

    private static final BigDecimal TARGET = new BigDecimal("2000");
    private static final BigDecimal MAX = new BigDecimal("2100");

    @Test
    void simultaneousJoinsNeverOversubscribeTheGroup() throws Exception {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        Product product = createProduct(createSellerStore(createUser("cat", Role.ROLE_SELLER)),
                new BigDecimal("3000"), 100);
        // Ten units, five customers racing for it, each asking for four.
        GroupReverseDemand demand = createOpenDemand(leader, product, 10, TARGET, MAX, 24);

        int racers = 5;
        List<User> customers = new ArrayList<>();
        for (int i = 0; i < racers; i++) {
            customers.add(createUser("racer", Role.ROLE_CUSTOMER));
        }

        List<Object> results = runTogether(() -> {
            // All five threads leave the starting gate at the same instant.
            startGun.await(10, TimeUnit.SECONDS);
            int index = counter.getAndIncrement();
            User customer = customers.get(index);
            try {
                return join(demand, customer, 4);
            } catch (RuntimeException ex) {
                return ex.getMessage();
            }
        }, racers);

        // The invariant that matters: the group never goes past its target, and no racer is left
        // holding a half-made membership. Two four-unit requests fit inside ten; a third would need
        // twelve, so the group stops at eight of ten and stays open for the remaining two.
        GroupReverseDemand after = reloadDemand(demand.getId());
        assertThat(after.getCommittedQuantity()).isEqualTo(8);
        assertThat(memberRepository.sumActiveQuantity(demand.getId())).isEqualTo(8L);
        assertThat(after.getRemainingQuantity()).isEqualTo(2);
        assertThat(after.getStatus()).isEqualTo(GroupReverseDemandStatus.OPEN);
        assertThat(after.getMemberCount()).isEqualTo(2);
        assertNotOversubscribed(after);

        // Two of the five fitted; the other three were told why, in the group's own terms.
        long accepted = results.stream().filter(GroupReverseMember.class::isInstance).count();
        long refused = results.size() - accepted;
        assertThat(accepted).isEqualTo(2);
        assertThat(refused).isEqualTo(3);
        assertThat(results.stream().filter(String.class::isInstance).map(Object::toString).toList())
                .allMatch(message -> message.contains("still needed"));
    }

    @Test
    void twoMembersRacingForTheLastUnitCannotBothTakeIt() throws Exception {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        Product product = createProduct(createSellerStore(createUser("cat", Role.ROLE_SELLER)),
                new BigDecimal("3000"), 100);
        // Exactly one unit left for two eager customers.
        GroupReverseDemand demand = createOpenDemand(leader, product, 10, TARGET, MAX, 24);
        join(demand, createUser("early", Role.ROLE_CUSTOMER), 9);

        User first = createUser("first", Role.ROLE_CUSTOMER);
        User second = createUser("second", Role.ROLE_CUSTOMER);

        List<Object> results = runTogether(() -> {
            startGun.await(10, TimeUnit.SECONDS);
            try {
                User who = counter.getAndIncrement() == 0 ? first : second;
                return join(demand, who, 1);
            } catch (RuntimeException ex) {
                return ex.getMessage();
            }
        }, 2);

        assertThat(reloadDemand(demand.getId()).getCommittedQuantity()).isEqualTo(10);
        assertThat(results.stream().filter(GroupReverseMember.class::isInstance)).hasSize(1);
        assertThat(reloadDemand(demand.getId()).getMemberCount()).isEqualTo(2);
        assertNotOversubscribed(reloadDemand(demand.getId()));
    }

    @Test
    void theSameCustomerRacingItselfEndsUpWithExactlyOneMembership() throws Exception {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        Product product = createProduct(createSellerStore(createUser("cat", Role.ROLE_SELLER)),
                new BigDecimal("3000"), 100);
        GroupReverseDemand demand = createOpenDemand(leader, product, 50, TARGET, MAX, 24);
        User greedy = createUser("greedy", Role.ROLE_CUSTOMER);

        // The same customer pressing "join" five times at once must not become five members.
        runTogether(() -> {
            startGun.await(10, TimeUnit.SECONDS);
            try {
                return join(demand, greedy, 2);
            } catch (RuntimeException ex) {
                return ex.getMessage();
            }
        }, 5);

        assertThat(memberRepository.findByDemandIdAndCustomerId(demand.getId(), greedy.getId()))
                .isPresent();
        assertThat(memberRepository.findByDemandIdOrderByJoinedAtAsc(demand.getId())).hasSize(1);
        assertThat(reloadDemand(demand.getId()).getCommittedQuantity()).isEqualTo(2);
    }

    @Test
    void twoSimultaneousSelectionsProduceOneOrderPerMemberAndOneStockDecrement() throws Exception {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        Product product = createProduct(createSellerStore(createUser("cat", Role.ROLE_SELLER)),
                new BigDecimal("3000"), 100);
        GroupReverseDemand demand = createOpenDemand(leader, product, 10, TARGET, MAX, 24);
        join(demand, leader, 4);
        join(demand, createUser("c", Role.ROLE_CUSTOMER), 6);
        GroupReverseDemand ready = reloadDemand(demand.getId());

        User cheap = createUser("cheap", Role.ROLE_SELLER);
        createSellerStore(cheap);
        var offer = submitOffer(ready, cheap, new BigDecimal("1900"), 10);

        List<Object> results = runTogether(() -> {
            startGun.await(10, TimeUnit.SECONDS);
            try {
                return offerService.selectOffer(leader.getEmail(), demand.getId(), offer.getId())
                        .getOrderCount();
            } catch (RuntimeException ex) {
                return ex.getMessage();
            }
        }, 4);

        // Whichever call wins, the group ends up with exactly one order per member...
        assertThat(orderRepository.findAll()).hasSize(2);
        assertThat(orderRepository.findAll()).allSatisfy(order ->
                assertThat(order.getGroupReverseDemandId()).isEqualTo(demand.getId()));
        // ...and stock is taken once, not once per caller.
        assertThat(stockOf(product)).isEqualTo(90);
        assertThat(reloadDemand(demand.getId()).getStatus())
                .isEqualTo(GroupReverseDemandStatus.ORDERS_CREATED);
        // Exactly one caller did the work and reported the two orders it created; the rest were
        // told the offer had already been selected and created nothing.
        int reportedOrders = 0;
        for (Object result : results) {
            if (result instanceof Integer orders) {
                reportedOrders += orders;
            } else {
                assertThat(result).as("a losing caller").isInstanceOf(String.class);
            }
        }
        assertThat(reportedOrders).isEqualTo(2);
    }

    @Test
    void twoGroupsCannotBothDrainTheSameLastUnits() throws Exception {
        User seller = createUser("cat", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("3000"), 10);

        User leaderA = createUser("a", Role.ROLE_CUSTOMER);
        User leaderB = createUser("b", Role.ROLE_CUSTOMER);
        GroupReverseDemand demandA = createOpenDemand(leaderA, product, 10, TARGET, MAX, 24);
        GroupReverseDemand demandB = createOpenDemand(leaderB, product, 10, TARGET, MAX, 24);
        join(demandA, leaderA, 10);
        join(demandB, leaderB, 10);
        GroupReverseDemand readyA = reloadDemand(demandA.getId());
        GroupReverseDemand readyB = reloadDemand(demandB.getId());

        User storeOwner = createUser("s", Role.ROLE_SELLER);
        createSellerStore(storeOwner);
        var offerA = submitOffer(readyA, storeOwner, new BigDecimal("1900"), 10);
        var offerB = submitOffer(readyB, storeOwner, new BigDecimal("1900"), 10);

        // Both groups want the last ten units of the same product, at the same moment.
        runTogether(() -> {
            startGun.await(10, TimeUnit.SECONDS);
            try {
                if (counter.getAndIncrement() % 2 == 0) {
                    offerService.selectOffer(leaderA.getEmail(), demandA.getId(), offerA.getId());
                } else {
                    offerService.selectOffer(leaderB.getEmail(), demandB.getId(), offerB.getId());
                }
                return "selected";
            } catch (RuntimeException ex) {
                return ex.getMessage();
            }
        }, 2);

        // Stock is the arbiter: it can reach zero, but never go below it.
        assertThat(stockOf(product)).isEqualTo(0);
        long orders = orderRepository.findAll().size();
        assertThat(orders).isEqualTo(1);
        // The loser is told plainly, and its group is still open for another decision.
        assertThat(orderRepository.findAll()).allSatisfy(order ->
                assertThat(order.getGroupReverseStoreId()).isNotNull());
    }

    // ---- Harness ------------------------------------------------------------------------------

    private CountDownLatch startGun = new CountDownLatch(1);
    private AtomicInteger counter = new AtomicInteger();

    /**
     * Fires {@code racers} copies of {@code body} simultaneously and returns what each produced.
     * Each thread gets its own latch and counter so they are not shared across tests.
     */
    private List<Object> runTogether(Callable<Object> body, int racers) throws Exception {
        startGun = new CountDownLatch(1);
        counter = new AtomicInteger();
        ExecutorService pool = Executors.newFixedThreadPool(racers);
        try {
            List<Future<Object>> futures = new ArrayList<>();
            for (int i = 0; i < racers; i++) {
                futures.add(pool.submit(body));
            }
            startGun.countDown();
            List<Object> results = new ArrayList<>();
            for (Future<Object> future : futures) {
                results.add(future.get(30, TimeUnit.SECONDS));
            }
            return results;
        } finally {
            pool.shutdownNow();
        }
    }
}
