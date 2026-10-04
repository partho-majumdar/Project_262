package com.groupmart.groupreverse;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import com.groupmart.dto.groupr.GroupReverseSelectionResultDto;
import com.groupmart.entity.*;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The reference acceptance scenario, end to end: one customer raises a demand for 50 units, three
 * others fill the group, three sellers bid, the creator picks one, and four individual orders appear.
 */
class GroupReverseFlowTest extends AbstractGroupReverseTest {

    private static final BigDecimal TARGET = new BigDecimal("2000");
    private static final BigDecimal MAX = new BigDecimal("2100");

    @Test
    void theReferenceScenarioRunsEndToEnd() {
        // --- 1-2. Customer A creates the demand and publishes it ---------------------------------
        User sellerOfCatalog = createUser("catalog", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(sellerOfCatalog), new BigDecimal("3000"), 50);
        User a = createUser("alice", Role.ROLE_CUSTOMER);

        GroupReverseDemand demand = createOpenDemand(a, product, 50, TARGET, MAX, 24);
        assertThat(demand.getStatus()).isEqualTo(GroupReverseDemandStatus.OPEN);
        assertThat(demand.getLeader().getId()).isEqualTo(a.getId());
        assertThat(demand.getCommittedQuantity()).isZero();

        // --- 3-5. B, C and D join, and A takes 10 for herself -------------------------------------
        User b = createUser("bob", Role.ROLE_CUSTOMER);
        User c = createUser("carol", Role.ROLE_CUSTOMER);
        User d = createUser("dave", Role.ROLE_CUSTOMER);

        join(demand, a, 10);
        join(demand, b, 15);
        join(demand, c, 10);
        GroupReverseDemand beforeLast = reloadDemand(demand.getId());
        assertThat(beforeLast.getCommittedQuantity()).isEqualTo(35);
        assertThat(beforeLast.getStatus()).isEqualTo(GroupReverseDemandStatus.OPEN);

        join(demand, d, 15);

        // --- 6-7. The target is met and the seller round opens ------------------------------------
        GroupReverseDemand reached = reloadDemand(demand.getId());
        assertThat(reached.getCommittedQuantity()).isEqualTo(50);
        assertThat(reached.getMemberCount()).isEqualTo(4);
        assertThat(reached.getStatus()).isEqualTo(GroupReverseDemandStatus.READY_FOR_OFFERS);
        assertThat(reached.getTargetReachedAt()).isNotNull();
        assertThat(reached.getRemainingQuantity()).isZero();

        // --- 8-11. Three competing sellers bid ---------------------------------------------------
        User sellerA = createUser("sa", Role.ROLE_SELLER);
        User sellerB = createUser("sb", Role.ROLE_SELLER);
        User sellerC = createUser("sc", Role.ROLE_SELLER);
        createSellerStore(sellerA);
        createSellerStore(sellerB);
        createSellerStore(sellerC);

        var offerA = submitOffer(reached, sellerA, new BigDecimal("2000"), 50);
        var offerB = submitOffer(reached, sellerB, new BigDecimal("1900"), 50);
        var offerC = submitOffer(reached, sellerC, new BigDecimal("1950"), 50);

        assertThat(reloadDemand(demand.getId()).getStatus())
                .isEqualTo(GroupReverseDemandStatus.OFFERS_RECEIVED);
        assertThat(reloadDemand(demand.getId()).getOfferCount()).isEqualTo(3);
        assertThat(List.of(offerA, offerB, offerC)).allMatch(o ->
                o.getStatus() == GroupReverseOfferStatus.SUBMITTED);

        // --- 12. The leader compares all three --------------------------------------------------
        var comparison = demandService.getDemand(a.getEmail(), demand.getId());
        var offers = offerService.getOffersForDemand(a.getEmail(), demand.getId());
        assertThat(offers).hasSize(3);
        assertThat(offers).allSatisfy(o -> assertThat(o.isSelectable()).isTrue());

        // --- 13-14. The leader selects seller B, and the price locks ------------------------------
        GroupReverseSelectionResultDto result = offerService.selectOffer(a.getEmail(), demand.getId(),
                offerB.getId());
        assertThat(result.getSelectedOffer().getId()).isEqualTo(offerB.getId());
        assertThat(result.getOrderCount()).isEqualTo(4);
        assertThat(result.getTotalUnits()).isEqualTo(50);
        // 50 x 1900 with no delivery fee.
        assertThat(result.getGrandTotal()).isEqualByComparingTo(new BigDecimal("95000"));

        GroupReverseDemand selected = reloadDemand(demand.getId());
        assertThat(selected.getStatus()).isEqualTo(GroupReverseDemandStatus.ORDERS_CREATED);
        assertThat(selected.getLockedUnitPrice()).isEqualByComparingTo(new BigDecimal("1900"));
        assertThat(selected.getSelectedOffer().getId()).isEqualTo(offerB.getId());
        assertThat(selected.getOfferSelectedAt()).isNotNull();
        assertThat(selected.getOrdersCreatedAt()).isNotNull();

        // --- 15-16. One individual order per member, at the locked price -------------------------
        var orders = orderRepository.findAll();
        assertThat(orders).hasSize(4);
        assertThat(orders).allSatisfy(order -> {
            assertThat(order.getOrderType()).isEqualTo(OrderType.GROUP_REVERSE_BUYING);
            assertThat(order.getGroupReverseDemandId()).isEqualTo(demand.getId());
            assertThat(order.getGroupReverseStoreId()).isEqualTo(offerB.getSellerStore().getId());
            assertThat(order.getStatus()).isEqualTo(OrderStatus.PENDING);
            assertThat(order.getOrderNumber()).startsWith("ORD-");
        });

        // Each member's own quantity, their own order, their own total.
        assertOrderFor(a, 10, new BigDecimal("19000"), demand);
        assertOrderFor(b, 15, new BigDecimal("28500"), demand);
        assertOrderFor(c, 10, new BigDecimal("19000"), demand);
        assertOrderFor(d, 15, new BigDecimal("28500"), demand);

        // The leader holds no order covering anybody else's units: her order is 10 units, not 50.
        Order leaderOrder = orderRepository.findAll().stream()
                .filter(o -> o.getUser().getId().equals(a.getId()))
                .findFirst().orElseThrow();
        assertThat(leaderOrder.getTotalAmount()).isEqualByComparingTo(new BigDecimal("19000"));
        assertThat(orderRepository.findAll()).allSatisfy(o ->
                assertThat(o.getUser().getId()).isNotNull());

        // --- 17-18. The losing bids are closed, the winner is recorded ---------------------------
        assertThat(reloadOffer(offerA.getId()).getStatus()).isEqualTo(GroupReverseOfferStatus.CLOSED);
        assertThat(reloadOffer(offerC.getId()).getStatus()).isEqualTo(GroupReverseOfferStatus.CLOSED);
        assertThat(reloadOffer(offerB.getId()).getStatus()).isEqualTo(GroupReverseOfferStatus.ACCEPTED);
        assertThat(groupOfferRepository.findAcceptedByDemand(demand.getId())).hasSize(1);

        // --- 19-20. Stock was committed to the winner, exactly once ------------------------------
        // Nothing was reserved while the group formed; the full 50 was taken at selection.
        assertThat(stockOf(product)).isEqualTo(0);

        // --- 21. Each member is told their own order is ready ------------------------------------
        assertThat(notificationRepository.findByUserIdOrderByCreatedAtDesc(a.getId()))
                .anyMatch(n -> n.getTitle().contains("group order is ready"));
        assertThat(notificationRepository.findByUserIdOrderByCreatedAtDesc(sellerB.getId()))
                .anyMatch(n -> n.getTitle().contains("won the group order"));
        assertThat(notificationRepository.findByUserIdOrderByCreatedAtDesc(sellerA.getId()))
                .anyMatch(n -> n.getTitle().contains("not selected"));
    }

    // ---- Rule checks that fall out of the scenario --------------------------------------------

    @Test
    void onlyTheCreatorMaySelectAnOffer() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        User other = createUser("other", Role.ROLE_CUSTOMER);
        Product product = createProduct(createSellerStore(createUser("cat", Role.ROLE_SELLER)),
                new BigDecimal("3000"), 50);
        GroupReverseDemand demand = createOpenDemand(leader, product, 4, TARGET, MAX, 24);
        join(demand, leader, 2);
        join(demand, other, 2);
        GroupReverseDemand ready = reloadDemand(demand.getId());

        User seller = createUser("s", Role.ROLE_SELLER);
        createSellerStore(seller);
        var offer = submitOffer(ready, seller, new BigDecimal("1900"), 4);

        assertThatThrownBy(() -> offerService.selectOffer(other.getEmail(), demand.getId(), offer.getId()))
                .hasMessageContaining("Only the demand creator");
        // A seller cannot select either.
        assertThatThrownBy(() -> offerService.selectOffer(seller.getEmail(), demand.getId(), offer.getId()))
                .hasMessageContaining("Only the demand creator");
    }

    @Test
    void aPlainMemberCannotReadTheCompetingOffers() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        User member = createUser("member", Role.ROLE_CUSTOMER);
        Product product = createProduct(createSellerStore(createUser("cat", Role.ROLE_SELLER)),
                new BigDecimal("3000"), 50);
        GroupReverseDemand demand = createOpenDemand(leader, product, 4, TARGET, MAX, 24);
        join(demand, leader, 2);
        join(demand, member, 2);
        GroupReverseDemand ready = reloadDemand(demand.getId());
        User seller = createUser("s", Role.ROLE_SELLER);
        createSellerStore(seller);
        submitOffer(ready, seller, new BigDecimal("1900"), 4);

        assertThatThrownBy(() -> offerService.getOffersForDemand(member.getEmail(), demand.getId()))
                .hasMessageContaining("Only the demand creator");
    }

    @Test
    void selectingTwiceIsRefusedAndSelectingTheSameOfferAgainIsANoOp() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        Product product = createProduct(createSellerStore(createUser("cat", Role.ROLE_SELLER)),
                new BigDecimal("3000"), 50);
        GroupReverseDemand demand = createOpenDemand(leader, product, 4, TARGET, MAX, 24);
        join(demand, leader, 4);
        GroupReverseDemand ready = reloadDemand(demand.getId());

        User seller = createUser("s", Role.ROLE_SELLER);
        createSellerStore(seller);
        var offer = submitOffer(ready, seller, new BigDecimal("1900"), 4);

        offerService.selectOffer(leader.getEmail(), demand.getId(), offer.getId());

        // The same offer again is harmless: no second order, no extra stock taken.
        var repeat = offerService.selectOffer(leader.getEmail(), demand.getId(), offer.getId());
        assertThat(repeat.getOrderCount()).isZero();
        assertThat(repeat.getNote()).contains("already selected");
        assertThat(orderRepository.findAll()).hasSize(1);
        assertThat(stockOf(product)).isEqualTo(46);

        // A different offer is refused outright.
        User seller2 = createUser("s2", Role.ROLE_SELLER);
        createSellerStore(seller2);
        assertThatThrownBy(() -> offerService.selectOffer(leader.getEmail(), demand.getId(),
                UUID.randomUUID())).hasMessageContaining("already been selected");
    }

    @Test
    void theGroupQuantityIsFrozenOnceAnOfferIsSelected() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        User latecomer = createUser("late", Role.ROLE_CUSTOMER);
        Product product = createProduct(createSellerStore(createUser("cat", Role.ROLE_SELLER)),
                new BigDecimal("3000"), 50);
        GroupReverseDemand demand = createOpenDemand(leader, product, 4, TARGET, MAX, 24);
        join(demand, leader, 4);
        GroupReverseDemand ready = reloadDemand(demand.getId());
        User seller = createUser("s", Role.ROLE_SELLER);
        createSellerStore(seller);
        var offer = submitOffer(ready, seller, new BigDecimal("1900"), 4);
        offerService.selectOffer(leader.getEmail(), demand.getId(), offer.getId());

        assertThatThrownBy(() -> join(reloadDemand(demand.getId()), latecomer, 1))
                .hasMessageContaining("already reached its target quantity");
    }

    // ---- Helpers ---------------------------------------------------------------------------------

    private void assertOrderFor(User customer, int quantity, BigDecimal total, GroupReverseDemand demand) {
        Order order = orderRepository.findAll().stream()
                .filter(o -> o.getUser().getId().equals(customer.getId()))
                .findFirst().orElseThrow(() -> new AssertionError("no order for " + customer.getEmail()));
        assertThat(order.getTotalAmount()).isEqualByComparingTo(total);
        assertThat(order.getItems().get(0).getQuantity()).isEqualTo(quantity);
        assertThat(order.getItems().get(0).getUnitPrice()).isEqualByComparingTo(new BigDecimal("1900"));
        assertThat(order.getGroupReverseDemandId()).isEqualTo(demand.getId());
        // Every member ships to their own address, snapshotted at join time.
        assertThat(order.getShippingAddressLine1()).isEqualTo("18 Gavel Lane");
        assertThat(order.getShippingCity()).isEqualTo("Testville");
    }

    private GroupReverseOffer reloadOffer(UUID id) {
        return groupOfferRepository.findById(id).orElseThrow();
    }
}
