package com.groupmart.groupreverse;

import java.math.BigDecimal;

import com.groupmart.dto.groupr.GroupReverseDemandDto;
import com.groupmart.dto.groupr.GroupReverseMemberDto;
import com.groupmart.entity.*;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Rules around who may join a group, for how much, and what happens when they change their mind. */
class GroupReverseJoinTest extends AbstractGroupReverseTest {

    private static final BigDecimal TARGET = new BigDecimal("2000");
    private static final BigDecimal MAX = new BigDecimal("2100");

    private Product product(int stock) {
        return createProduct(createSellerStore(createUser("cat", Role.ROLE_SELLER)),
                new BigDecimal("3000"), stock);
    }

    @Test
    void committedQuantityTracksEachJoinAndTheTargetClosesTheGroup() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        GroupReverseDemand demand = createOpenDemand(leader, product(50), 10, TARGET, MAX, 24);

        assertThat(demand.getCommittedQuantity()).isZero();
        assertThat(demand.getRemainingQuantity()).isEqualTo(10);
        assertThat(demand.getStatus()).isEqualTo(GroupReverseDemandStatus.OPEN);

        join(demand, createUser("c1", Role.ROLE_CUSTOMER), 4);
        GroupReverseDemand after1 = reloadDemand(demand.getId());
        assertThat(after1.getCommittedQuantity()).isEqualTo(4);
        assertThat(after1.getMemberCount()).isEqualTo(1);
        assertThat(after1.getStatus()).isEqualTo(GroupReverseDemandStatus.OPEN);
        assertNotOversubscribed(after1);

        join(demand, createUser("c2", Role.ROLE_CUSTOMER), 6);
        GroupReverseDemand after2 = reloadDemand(demand.getId());
        assertThat(after2.getCommittedQuantity()).isEqualTo(10);
        assertThat(after2.getStatus()).isEqualTo(GroupReverseDemandStatus.READY_FOR_OFFERS);
        assertThat(after2.getRemainingQuantity()).isZero();
        assertThat(after2.getTargetReachedAt()).isNotNull();
    }

    @Test
    void theGroupRefusesToOversubscribe() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        GroupReverseDemand demand = createOpenDemand(leader, product(50), 10, TARGET, MAX, 24);
        join(demand, createUser("c1", Role.ROLE_CUSTOMER), 7);

        // Only 3 units left, so a request for 4 is refused outright rather than partially filled.
        assertThatThrownBy(() -> join(demand, createUser("c2", Role.ROLE_CUSTOMER), 4))
                .hasMessageContaining("are still needed");

        GroupReverseDemand unchanged = reloadDemand(demand.getId());
        assertThat(unchanged.getCommittedQuantity()).isEqualTo(7);
        assertThat(unchanged.getStatus()).isEqualTo(GroupReverseDemandStatus.OPEN);
        assertNotOversubscribed(unchanged);

        // Exactly the remainder still works.
        join(demand, createUser("c3", Role.ROLE_CUSTOMER), 3);
        assertThat(reloadDemand(demand.getId()).getStatus())
                .isEqualTo(GroupReverseDemandStatus.READY_FOR_OFFERS);
    }

    @Test
    void aMemberCannotJoinTheSameGroupTwice() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        User customer = createUser("c", Role.ROLE_CUSTOMER);
        GroupReverseDemand demand = createOpenDemand(leader, product(50), 20, TARGET, MAX, 24);
        join(demand, customer, 5);

        assertThatThrownBy(() -> join(demand, customer, 5))
                .hasMessageContaining("already joined");
        assertThat(reloadDemand(demand.getId()).getCommittedQuantity()).isEqualTo(5);
        assertThat(memberRepository.findByDemandIdOrderByJoinedAtAsc(demand.getId())).hasSize(1);
    }

    @Test
    void aJoinMustRespectThePerMemberMinimumAndMaximum() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        Product p = product(50);
        GroupReverseDemand demand = createDraftDemand(leader, p, 20, TARGET, MAX, 24);
        assertThat(demand.getMinQuantityPerMember()).isEqualTo(1);
        assertThat(demand.getMaxQuantityPerMember()).isEqualTo(20);
        demandService.publishDemand(leader.getEmail(), demand.getId());
        GroupReverseDemand open = reloadDemand(demand.getId());

        assertThatThrownBy(() -> join(open, createUser("zero", Role.ROLE_CUSTOMER), 0))
                .hasMessageContaining("at least");
        assertThatThrownBy(() -> join(open, createUser("toomuch", Role.ROLE_CUSTOMER), 21))
                .hasMessageContaining("at most");
        assertThatThrownBy(() -> join(open, createUser("neg", Role.ROLE_CUSTOMER), -3))
                .hasMessageContaining("at least");
        assertThat(reloadDemand(open.getId()).getCommittedQuantity()).isZero();
    }

    @Test
    void leavingFreesQuantityForSomebodyElse() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        User c1 = createUser("c1", Role.ROLE_CUSTOMER);
        GroupReverseDemand demand = createOpenDemand(leader, product(50), 10, TARGET, MAX, 24);
        join(demand, c1, 4);
        join(demand, createUser("c2", Role.ROLE_CUSTOMER), 5);
        assertThat(reloadDemand(demand.getId()).getCommittedQuantity()).isEqualTo(9);

        participationService.leaveDemand(c1.getEmail(), demand.getId(), "Changed my mind");
        GroupReverseDemand after = reloadDemand(demand.getId());
        assertThat(after.getCommittedQuantity()).isEqualTo(5);
        assertThat(after.getMemberCount()).isEqualTo(1);
        assertNotOversubscribed(after);

        // The freed units are claimable again.
        join(demand, createUser("c3", Role.ROLE_CUSTOMER), 5);
        assertThat(reloadDemand(demand.getId()).getStatus())
                .isEqualTo(GroupReverseDemandStatus.READY_FOR_OFFERS);
    }

    @Test
    void leavingAfterAnOfferIsSelectedIsRefusedBecauseTheUnitsAreAlreadySold() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        User c1 = createUser("c1", Role.ROLE_CUSTOMER);
        GroupReverseDemand demand = createOpenDemand(leader, product(50), 4, TARGET, MAX, 24);
        join(demand, leader, 2);
        join(demand, c1, 2);
        GroupReverseDemand ready = reloadDemand(demand.getId());
        User seller = createUser("s", Role.ROLE_SELLER);
        createSellerStore(seller);
        var offer = submitOffer(ready, seller, new BigDecimal("1900"), 4);
        offerService.selectOffer(leader.getEmail(), demand.getId(), offer.getId());

        assertThatThrownBy(() -> participationService.leaveDemand(c1.getEmail(), demand.getId(), "late"))
                .hasMessageContaining("already been selected");
        assertThat(reloadDemand(demand.getId()).getCommittedQuantity()).isEqualTo(4);
    }

    @Test
    void theCreatorIsBothLeaderAndAnOrdinaryMember() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        GroupReverseDemand demand = createOpenDemand(leader, product(50), 10, TARGET, MAX, 24);
        GroupReverseMember membership = join(demand, leader, 2);

        assertThat(membership.getStatus()).isEqualTo(GroupReverseMemberStatus.JOINED);
        assertThat(membership.getRequestedQuantity()).isEqualTo(2);
        // The leader flag is reported from the DTO, and the member row is a real membership row.
        GroupReverseMemberDto mine =
                participationService.getMyMembership(leader.getEmail(), demand.getId());
        assertThat(mine.getStatus()).isEqualTo(GroupReverseMemberStatus.JOINED);
        assertThat(demandService.getDemand(leader.getEmail(), demand.getId()).isLeader()).isTrue();
    }

    @Test
    void aMemberSeesOnlyTheirOwnMembershipAndTheRosterOnlyTheLeaderMayRead() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        User c1 = createUser("c1", Role.ROLE_CUSTOMER);
        GroupReverseDemand demand = createOpenDemand(leader, product(50), 20, TARGET, MAX, 24);
        join(demand, c1, 5);

        // The leader may read the roster; it shows real names, because that is the group's point.
        var roster = demandService.getMembers(leader.getEmail(), demand.getId());
        assertThat(roster).hasSize(1);
        assertThat(roster.get(0).getRequestedQuantity()).isEqualTo(5);
        assertThat(roster.get(0).getCustomerName()).isNotBlank();

        // A member is given their own row and nothing else - not a refusal, and not the roster.
        var ownOnly = demandService.getMembers(c1.getEmail(), demand.getId());
        assertThat(ownOnly).hasSize(1);
        assertThat(ownOnly.get(0).getCustomerId()).isEqualTo(c1.getId());
        assertThat(ownOnly).noneMatch(m -> !m.getCustomerId().equals(c1.getId()));

        // A member's own view carries their own membership, and nobody else's.
        var view = demandService.getDemand(c1.getEmail(), demand.getId());
        assertThat(view.isLeader()).isFalse();
        assertThat(view.getMyMembership()).isNotNull();
        assertThat(view.getMyMembership().getRequestedQuantity()).isEqualTo(5);
    }

    @Test
    void aNonMemberHasNoMembershipAndNoRoster() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        User stranger = createUser("stranger", Role.ROLE_CUSTOMER);
        GroupReverseDemand demand = createOpenDemand(leader, product(50), 20, TARGET, MAX, 24);

        // Nothing to show, and nothing leaked: no membership, and no roster either.
        assertThat(participationService.getMyMembership(stranger.getEmail(), demand.getId())).isNull();
        assertThatThrownBy(() -> demandService.getMembers(stranger.getEmail(), demand.getId()))
                .hasMessageContaining("not a member of this group");
    }

    @Test
    void joiningRequiresARealOwnedAddressAndAValidPaymentMethod() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        GroupReverseDemand demand = createOpenDemand(leader, product(50), 20, TARGET, MAX, 24);
        User c1 = createUser("c1", Role.ROLE_CUSTOMER);
        User c2 = createUser("c2", Role.ROLE_CUSTOMER);
        User c3 = createUser("c3", Role.ROLE_CUSTOMER);
        Address c1Address = createAddress(c1);
        Address c2Address = createAddress(c2);

        // An address that does not exist at all.
        assertThatThrownBy(() -> participationService.joinDemand(c1.getEmail(), demand.getId(),
                com.groupmart.dto.groupr.JoinGroupReverseDemandRequest.builder()
                        .quantity(2).addressId(java.util.UUID.randomUUID())
                        .paymentMethod("CREDIT_CARD").build()))
                .hasMessageContaining("Address not found");

        // Somebody else's address is not a delivery address for this customer.
        assertThatThrownBy(() -> participationService.joinDemand(c2.getEmail(), demand.getId(),
                com.groupmart.dto.groupr.JoinGroupReverseDemandRequest.builder()
                        .quantity(2).addressId(c1Address.getId())
                        .paymentMethod("CREDIT_CARD").build()))
                .hasMessageContaining("on your own account");

        // An address must be supplied.
        assertThatThrownBy(() -> participationService.joinDemand(c3.getEmail(), demand.getId(),
                com.groupmart.dto.groupr.JoinGroupReverseDemandRequest.builder()
                        .quantity(2).paymentMethod("CREDIT_CARD").build()))
                .hasMessageContaining("address");

        // A real, owned address with an unknown payment method.
        assertThatThrownBy(() -> participationService.joinDemand(c2.getEmail(), demand.getId(),
                com.groupmart.dto.groupr.JoinGroupReverseDemandRequest.builder()
                        .quantity(2).addressId(c2Address.getId())
                        .paymentMethod("SMOKE_SIGNAL").build()))
                .hasMessageContaining("payment method");

        // None of the refusals left a membership or any committed quantity behind.
        assertThat(reloadDemand(demand.getId()).getCommittedQuantity()).isZero();
        assertThat(memberRepository.findByDemandIdOrderByJoinedAtAsc(demand.getId())).isEmpty();

        // The same request, corrected, joins cleanly.
        participationService.joinDemand(c2.getEmail(), demand.getId(),
                com.groupmart.dto.groupr.JoinGroupReverseDemandRequest.builder()
                        .quantity(2).addressId(c2Address.getId())
                        .paymentMethod("CREDIT_CARD").build());
        assertThat(reloadDemand(demand.getId()).getCommittedQuantity()).isEqualTo(2);
    }

    @Test
    void theJoinDeadlineIsEnforcedAtTheMomentOfJoining() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        GroupReverseDemand demand = createOpenDemand(leader, product(50), 20, TARGET, MAX, 24);
        // Push the deadline into the past without going through the scheduler.
        GroupReverseDemand mutable = reloadDemand(demand.getId());
        mutable.setJoinDeadline(java.time.LocalDateTime.now().minusMinutes(1));
        demandRepository.saveAndFlush(mutable);

        assertThatThrownBy(() -> join(reloadDemand(demand.getId()), createUser("late", Role.ROLE_CUSTOMER), 2))
                .hasMessageContaining("join deadline");
    }

    @Test
    void theLedAndJoinedListsAreDisjointAndNeitherIsEmpty() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        User member = createUser("member", Role.ROLE_CUSTOMER);
        GroupReverseDemand demand = createOpenDemand(leader, product(50), 20, TARGET, MAX, 24);
        join(demand, member, 5);

        // The leader holds the decision on this group, so it belongs to my-led...
        var ledAsLeader = demandService.getMyLedDemands(leader.getEmail());
        assertThat(ledAsLeader).extracting(d -> d.getId()).contains(demand.getId());
        // ...and not, duplicated, to my-joined.
        assertThat(participationService.getMyJoinedDemands(leader.getEmail()))
                .extracting(d -> d.getId()).doesNotContain(demand.getId());

        // A member has the mirror image: the group shows up where they took part, and nowhere else.
        var joinedAsMember = participationService.getMyJoinedDemands(member.getEmail());
        assertThat(joinedAsMember).extracting(d -> d.getId()).contains(demand.getId());
        assertThat(demandService.getMyLedDemands(member.getEmail())).isEmpty();

        // The joined entry carries the same card shape as a led one, with the member's own share.
        GroupReverseDemandDto card = joinedAsMember.get(0);
        assertThat(card.getId()).isEqualTo(demand.getId());
        assertThat(card.isLeader()).isFalse();
        assertThat(card.getMyMembership()).isNotNull();
        assertThat(card.getMyMembership().getRequestedQuantity()).isEqualTo(5);
    }

    @Test
    void aCustomerWhoJoinsTwoGroupsSeesBothOnce() {
        User firstLeader = createUser("leaderA", Role.ROLE_CUSTOMER);
        User secondLeader = createUser("leaderB", Role.ROLE_CUSTOMER);
        User member = createUser("member", Role.ROLE_CUSTOMER);
        Product product = product(100);
        GroupReverseDemand first = createOpenDemand(firstLeader, product, 20, TARGET, MAX, 24);
        GroupReverseDemand second = createOpenDemand(secondLeader, product, 20, TARGET, MAX, 24);
        join(first, member, 5);
        join(second, member, 5);

        var joined = participationService.getMyJoinedDemands(member.getEmail());
        assertThat(joined).extracting(d -> d.getId())
                .containsExactlyInAnyOrder(first.getId(), second.getId());
        // Neither is one they lead, so the led list stays empty.
        assertThat(demandService.getMyLedDemands(member.getEmail())).isEmpty();
    }

    @Test
    void aMemberWhoLeavesIsOutOfTheGroupForGood() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        User member = createUser("member", Role.ROLE_CUSTOMER);
        GroupReverseDemand demand = createOpenDemand(leader, product(50), 20, TARGET, MAX, 24);
        join(demand, member, 5);
        participationService.leaveDemand(member.getEmail(), demand.getId(), "changed my mind");

        // The quantity is released, but the membership is spent: rejoining would mean a second row
        // for the same customer and the same group, and the unique index is there deliberately.
        assertThatThrownBy(() -> join(demand, member, 5))
                .hasMessageContaining("already joined");
        assertThat(participationService.getMyJoinedDemands(member.getEmail()))
                .extracting(d -> d.getId()).containsExactly(demand.getId());
        assertThat(memberRepository.findByDemandIdAndCustomerId(demand.getId(), member.getId())
                .orElseThrow().getStatus()).isEqualTo(GroupReverseMemberStatus.CANCELLED);
    }

    @Test
    void aDraftDemandIsNotJoinable() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        GroupReverseDemand draft = createDraftDemand(leader, product(50), 20, TARGET, MAX, 24);
        assertThat(draft.getStatus()).isEqualTo(GroupReverseDemandStatus.DRAFT);

        assertThatThrownBy(() -> join(draft, createUser("c", Role.ROLE_CUSTOMER), 2))
                .hasMessageContaining("not been published");
    }
}
