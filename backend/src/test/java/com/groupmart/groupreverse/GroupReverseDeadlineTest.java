package com.groupmart.groupreverse;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.groupmart.entity.*;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * What happens when nobody decides in time. The join round and the offer round both have to close
 * themselves, and a closed group must be genuinely dead: no late joins, no late orders, no stock
 * held against a deal that will never happen.
 */
class GroupReverseDeadlineTest extends AbstractGroupReverseTest {

    private static final BigDecimal TARGET = new BigDecimal("2000");
    private static final BigDecimal MAX = new BigDecimal("2100");

    private Product product(int stock) {
        return createProduct(createSellerStore(createUser("cat", Role.ROLE_SELLER)),
                new BigDecimal("3000"), stock);
    }

    /** Rewinds a deadline so the sweeper can see it as lapsed. */
    private void rewind(GroupReverseDemand demand, boolean join, boolean offer) {
        GroupReverseDemand mutable = demandRepository.findById(demand.getId()).orElseThrow();
        if (join) {
            mutable.setJoinDeadline(LocalDateTime.now().minusMinutes(5));
        }
        if (offer) {
            mutable.setOfferDeadline(LocalDateTime.now().minusMinutes(5));
        }
        demandRepository.saveAndFlush(mutable);
    }

    @Test
    void aJoinRoundThatLapsesClosesWithoutReachingItsTarget() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        GroupReverseDemand demand = createOpenDemand(leader, product(50), 20, TARGET, MAX, 24);
        User early = createUser("early", Role.ROLE_CUSTOMER);
        join(demand, early, 6);
        rewind(demand, true, false);

        scheduler.sweepDeadlines();

        GroupReverseDemand closed = reloadDemand(demand.getId());
        assertThat(closed.getStatus()).isEqualTo(GroupReverseDemandStatus.TARGET_NOT_REACHED);
        assertThat(closed.getCloseCode())
                .isEqualTo(GroupReverseCloseCode.JOIN_DEADLINE_PASSED_TARGET_UNMET);
        assertThat(closed.getClosedAt()).isNotNull();
        assertThat(closed.getCloseNote()).contains("6 of 20");
        // The partial group is wound up, not left dangling for sellers to bid on.
        assertThat(groupOfferRepository.findByDemandIdOrderByUnitPriceAscCreatedAtAsc(demand.getId()))
                .isEmpty();
        // The member who waited is told, and told that nothing was charged.
        assertThat(notificationRepository.findByUserIdOrderByCreatedAtDesc(early.getId()))
                .anyMatch(n -> n.getTitle().contains("Group demand expired")
                        && n.getMessage().contains("Nothing was charged"));
        assertThat(memberRepository.findByDemandIdAndCustomerId(demand.getId(), early.getId())
                .orElseThrow().getStatus()).isEqualTo(GroupReverseMemberStatus.CANCELLED);
    }

    @Test
    void aLapsedGroupRefusesLateJoinsEvenBeforeTheSweeperHasRun() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        GroupReverseDemand demand = createOpenDemand(leader, product(50), 20, TARGET, MAX, 24);
        rewind(demand, true, false);
        // No sweep yet: the join itself must still be refused, because the deadline is checked
        // against the clock and not against the last scheduled pass.
        assertThatThrownBy(() -> join(reloadDemand(demand.getId()),
                createUser("late", Role.ROLE_CUSTOMER), 2))
                .hasMessageContaining("join deadline");
    }

    @Test
    void aCompleteGroupIsNotClosedByALapsedJoinDeadline() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        GroupReverseDemand demand = createOpenDemand(leader, product(50), 10, TARGET, MAX, 24);
        join(demand, leader, 10);
        GroupReverseDemand ready = reloadDemand(demand.getId());
        rewind(ready, true, false);

        scheduler.sweepDeadlines();

        // The group is complete and mid-offer-round; that is not a failure to be wound up.
        GroupReverseDemand after = reloadDemand(demand.getId());
        assertThat(after.getStatus()).isEqualTo(GroupReverseDemandStatus.READY_FOR_OFFERS);
        assertThat(after.getCloseCode()).isNull();
    }

    @Test
    void anOfferRoundNobodyBidsOnClosesWithNoOffers() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        Product p = product(50);
        GroupReverseDemand demand = createOpenDemand(leader, p, 10, TARGET, MAX, 24);
        join(demand, leader, 10);
        GroupReverseDemand ready = reloadDemand(demand.getId());
        rewind(ready, false, true);

        scheduler.sweepDeadlines();

        GroupReverseDemand closed = reloadDemand(demand.getId());
        assertThat(closed.getStatus()).isEqualTo(GroupReverseDemandStatus.NO_OFFER);
        assertThat(closed.getCloseCode())
                .isEqualTo(GroupReverseCloseCode.OFFER_DEADLINE_PASSED_NO_OFFERS);
        assertThat(closed.getCloseNote()).contains("no seller offer");
        assertThat(orderRepository.findAll()).isEmpty();
        assertThat(stockOf(p)).isEqualTo(50);
        assertThat(notificationRepository.findByUserIdOrderByCreatedAtDesc(leader.getId()))
                .anyMatch(n -> n.getTitle().contains("closed without a seller"));
    }

    @Test
    void anOfferRoundNobodyDecidesOnExpiresTheBidsAndReleasesNobody() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        Product p = product(50);
        GroupReverseDemand demand = createOpenDemand(leader, p, 10, TARGET, MAX, 24);
        join(demand, leader, 10);
        GroupReverseDemand ready = reloadDemand(demand.getId());
        User seller = createUser("s", Role.ROLE_SELLER);
        createSellerStore(seller);
        submitOffer(ready, seller, new BigDecimal("1900"), 10);
        rewind(ready, false, true);

        scheduler.sweepDeadlines();

        GroupReverseDemand closed = reloadDemand(demand.getId());
        assertThat(closed.getStatus()).isEqualTo(GroupReverseDemandStatus.EXPIRED);
        assertThat(closed.getCloseCode())
                .isEqualTo(GroupReverseCloseCode.OFFER_DEADLINE_PASSED_UNSELECTED);
        // The bid is closed out and no member is committed to buying anything.
        assertThat(groupOfferRepository.findByDemandIdOrderByUnitPriceAscCreatedAtAsc(demand.getId())
                .get(0).getStatus()).isEqualTo(GroupReverseOfferStatus.EXPIRED);
        assertThat(orderRepository.findAll()).isEmpty();
        // Crucially, no stock was reserved for a deal that will never happen.
        assertThat(stockOf(p)).isEqualTo(50);
        assertThat(notificationRepository.findByUserIdOrderByCreatedAtDesc(seller.getId()))
                .anyMatch(n -> n.getTitle().contains("Your group offer expired"));
    }

    @Test
    void theLeaderCanCancelTheirOwnGroupAndEveryMemberIsReleased() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        GroupReverseDemand demand = createOpenDemand(leader, product(50), 20, TARGET, MAX, 24);
        User member = createUser("member", Role.ROLE_CUSTOMER);
        join(demand, member, 5);

        var cancelled = demandService.cancelDemand(leader.getEmail(), demand.getId(), "Found it cheaper");
        assertThat(cancelled.getStatus()).isEqualTo(GroupReverseDemandStatus.CANCELLED);
        assertThat(cancelled.getCloseCode()).isEqualTo("LEADER_CANCELLED");

        // The members are released, but the group keeps the number it actually reached: five people
        // really did commit, and erasing that would make the record a lie.
        assertThat(reloadDemand(demand.getId()).getCommittedQuantity()).isEqualTo(5);
        assertThat(memberRepository.findByDemandIdOrderByJoinedAtAsc(demand.getId()))
                .allMatch(m -> m.getStatus() == GroupReverseMemberStatus.CANCELLED);
        assertThat(notificationRepository.findByUserIdOrderByCreatedAtDesc(member.getId()))
                .anyMatch(n -> n.getTitle().contains("Group demand cancelled")
                        && n.getMessage().contains("reserved quantity has been released"));
    }

    @Test
    void aClosedGroupCannotBeReopenedByJoiningOrByBidding() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        Product p = product(50);
        GroupReverseDemand demand = createOpenDemand(leader, p, 20, TARGET, MAX, 24);
        join(demand, leader, 8);
        demandService.cancelDemand(leader.getEmail(), demand.getId(), "Changed my mind");
        GroupReverseDemand closed = reloadDemand(demand.getId());
        User seller = createUser("s", Role.ROLE_SELLER);
        createSellerStore(seller);

        assertThatThrownBy(() -> join(closed, createUser("late", Role.ROLE_CUSTOMER), 1))
                .hasMessageContaining("has ended");
        assertThatThrownBy(() -> submitOffer(closed, seller, new BigDecimal("1900"), 20))
                .hasMessageContaining("not accepting seller offers");
        assertThat(stockOf(p)).isEqualTo(50);
    }

    @Test
    void anAdminCanCancelAnyGroup() {
        User admin = createUser("admin", Role.ROLE_ADMIN);
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        GroupReverseDemand demand = createOpenDemand(leader, product(50), 20, TARGET, MAX, 24);
        join(demand, createUser("c1", Role.ROLE_CUSTOMER), 5);

        var cancelled = demandService.cancelByAdmin(demand.getId(), admin.getEmail(), "Policy breach");
        assertThat(cancelled.getStatus()).isEqualTo(GroupReverseDemandStatus.CANCELLED);
        assertThat(cancelled.getCloseCode()).isEqualTo("ADMIN_CANCELLED");
        assertThat(cancelled.getCloseNote()).isEqualTo("Policy breach");
        assertThat(reloadDemand(demand.getId()).getCommittedQuantity()).isEqualTo(5);
        assertThat(memberRepository.findByDemandIdOrderByJoinedAtAsc(demand.getId()))
                .allMatch(m -> m.getStatus() == GroupReverseMemberStatus.CANCELLED);
    }

    @Test
    void aFinishedGroupSurvivesRepeatedSweeps() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        Product p = product(50);
        GroupReverseDemand demand = createOpenDemand(leader, p, 10, TARGET, MAX, 24);
        join(demand, leader, 10);
        GroupReverseDemand ready = reloadDemand(demand.getId());
        User seller = createUser("s", Role.ROLE_SELLER);
        createSellerStore(seller);
        var offer = submitOffer(ready, seller, new BigDecimal("1900"), 10);
        offerService.selectOffer(leader.getEmail(), demand.getId(), offer.getId());

        // Rewind both deadlines to the past and sweep repeatedly: a completed group must survive,
        // stock must not be released, and orders must not be duplicated.
        rewind(demand, true, true);
        scheduler.sweepDeadlines();
        scheduler.sweepDeadlines();
        scheduler.sweepDeadlines();

        assertThat(reloadDemand(demand.getId()).getStatus())
                .isEqualTo(GroupReverseDemandStatus.ORDERS_CREATED);
        assertThat(reloadDemand(demand.getId()).getCloseCode()).isNull();
        assertThat(orderRepository.findAll()).hasSize(1);
        assertThat(stockOf(p)).isEqualTo(40);
        assertThat(groupOfferRepository.findAcceptedByDemand(demand.getId())).hasSize(1);
    }
}
