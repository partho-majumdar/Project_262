package com.groupmart.service.impl;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.groupr.GroupReverseDemandDto;
import com.groupmart.dto.groupr.GroupReverseMemberDto;
import com.groupmart.dto.groupr.JoinGroupReverseDemandRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.GroupReverseParticipationService;
import com.groupmart.service.NotificationService;

/**
 * Joining and leaving group reverse demands.
 * <p>
 * <b>This class is where over-subscription is prevented.</b> Every join re-reads the demand through
 * {@link GroupReverseDemandRepository#findByIdForUpdate}, which takes a {@code SELECT ... FOR UPDATE}
 * row lock. Two customers racing for the last few units therefore serialise: the second waits, and
 * when it finally reads the demand it sees the first customer's committed quantity already included
 * and refuses rather than pushing the total past the target. A plain optimistic read followed by a
 * check would let both succeed.
 * <p>
 * The unique constraint on {@code (demand_id, customer_id)} is the second line of defence, covering
 * the double-join case independently of the lock.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GroupReverseParticipationServiceImpl implements GroupReverseParticipationService {

    private static final String NOTIFICATION_TYPE = "GROUP_REVERSE";
    /** The only methods a winning member may pay with, matching the existing payment architecture. */
    private static final List<PaymentMethod> PAYABLE = List.of(
            PaymentMethod.CREDIT_CARD, PaymentMethod.PAYPAL, PaymentMethod.STRIPE);

    private final GroupReverseDemandRepository demandRepository;
    private final GroupReverseMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final AddressRepository addressRepository;
    private final NotificationService notificationService;
    private final GroupReverseMapper mapper;

    @Override
    @Transactional
    public GroupReverseMemberDto joinDemand(String customerEmail, UUID demandId,
                                            JoinGroupReverseDemandRequest request) {
        User customer = requireCustomer(customerEmail);
        LocalDateTime now = LocalDateTime.now();

        // The lock is taken before the state and quantity checks, so the checks below cannot be
        // invalidated by a concurrent join that lands a moment later.
        GroupReverseDemand demand = demandRepository.findByIdForUpdate(demandId)
                .orElseThrow(() -> new ResourceNotFoundException("Group demand", "id", demandId));

        if (demand.getStatus() != GroupReverseDemandStatus.OPEN) {
            throw bad(joinRefusal(demand, now));
        }
        if (!demand.getJoinDeadline().isAfter(now)) {
            throw bad("The join deadline for this group has passed.");
        }
        if (memberRepository.findByDemandIdAndCustomerId(demandId, customer.getId()).isPresent()) {
            throw new ApiException("You have already joined this group demand",
                    HttpStatus.CONFLICT);
        }
        // Note the leader is allowed to join like anybody else. Creating the demand confers selection
        // authority, not a quantity: in the reference scenario the creator takes 10 units out of the
        // 50 like every other member, and the uniqueness check above is what stops them joining twice.

        int quantity = request.getQuantity() == null ? 0 : request.getQuantity();
        if (quantity < demand.getMinQuantityPerMember()) {
            throw bad("Each member must take at least " + demand.getMinQuantityPerMember() + " unit(s).");
        }
        if (quantity > demand.getMaxQuantityPerMember()) {
            throw bad("Each member may take at most " + demand.getMaxQuantityPerMember() + " unit(s).");
        }
        if (quantity > demand.getRemainingQuantity()) {
            throw bad("Only " + demand.getRemainingQuantity() + " unit(s) are still needed to complete "
                    + "this group, so a request for " + quantity + " cannot be accepted.");
        }
        if (!demand.getProduct().isActive()) {
            throw bad("This product is no longer available for group buying.");
        }

        if (request.getAddressId() == null) {
            throw new ApiException("A delivery address is required to join a group demand",
                    HttpStatus.BAD_REQUEST);
        }
        Address address = addressRepository.findById(request.getAddressId())
                .orElseThrow(() -> new ResourceNotFoundException("Address", "id", request.getAddressId()));
        if (!address.getUser().getId().equals(customer.getId())) {
            throw new ApiException("You can only ship to an address on your own account",
                    HttpStatus.FORBIDDEN);
        }
        PaymentMethod paymentMethod = parsePaymentMethod(request.getPaymentMethod());

        GroupReverseMember member = GroupReverseMember.builder()
                .demand(demand)
                .customer(customer)
                .requestedQuantity(quantity)
                .status(GroupReverseMemberStatus.JOINED)
                .paymentMethod(paymentMethod)
                .shippingAddressLine1(address.getStreetAddress())
                .shippingAddressLine2(address.getApartment())
                .shippingCity(address.getCity())
                .shippingState(address.getState())
                .shippingPostalCode(address.getPostalCode())
                .shippingCountry(address.getCountry())
                .build();
        GroupReverseMember saved = memberRepository.save(member);

        // Re-derive the aggregates from the authoritative rows rather than trusting the in-memory
        // copy, so a previously cancelled member can never leave phantom quantity behind.
        long committed = memberRepository.sumActiveQuantity(demandId);
        long members = memberRepository.countActiveByDemandId(demandId);
        demand.setCommittedQuantity((int) committed);
        demand.setMemberCount((int) members);

        boolean targetJustReached = false;
        if (demand.isTargetReached() && demand.getTargetReachedAt() == null) {
            targetJustReached = true;
            reachTarget(demand, now);
        }
        demandRepository.save(demand);

        notify(customer, "You joined a group demand",
                "'" + shortText(demand.getProduct().getName(), 60) + "': you are in for " + quantity
                        + " unit(s). The group now stands at " + committed + " of "
                        + demand.getRequiredQuantity() + ".",
                "/group-reverse-demands/" + demandId);

        if (targetJustReached) {
            // reachTarget already told the leader the group is complete; nothing further is needed
            // here, but the flag is kept explicit so the milestone stays visible in the flow.
            log.debug("Group demand {} reached its target with {} units", demandId, committed);
        }
        return mapper.toMemberDto(saved);
    }

    @Override
    @Transactional
    public GroupReverseMemberDto leaveDemand(String customerEmail, UUID demandId, String reason) {
        User customer = requireCustomer(customerEmail);
        LocalDateTime now = LocalDateTime.now();

        GroupReverseDemand demand = demandRepository.findByIdForUpdate(demandId)
                .orElseThrow(() -> new ResourceNotFoundException("Group demand", "id", demandId));

        if (demand.getStatus().isLocked()) {
            throw bad("A seller has already been selected for this group, so quantities are locked. "
                    + "Cancel your individual order instead.");
        }
        if (demand.getStatus() != GroupReverseDemandStatus.OPEN) {
            throw bad("This group demand is no longer taking changes.");
        }

        GroupReverseMember member = memberRepository.findByDemandIdAndCustomerId(demandId, customer.getId())
                .orElseThrow(() -> new ApiException("You are not a member of this group demand",
                        HttpStatus.NOT_FOUND));
        if (!member.getStatus().isActive()) {
            return mapper.toMemberDto(member);
        }

        member.setStatus(GroupReverseMemberStatus.CANCELLED);
        member.setCancelledAt(now);
        member.setCancellationReason(reason == null || reason.isBlank()
                ? "The member left the group" : shortText(reason, 500));
        memberRepository.save(member);

        demand.setCommittedQuantity((int) memberRepository.sumActiveQuantity(demandId));
        demand.setMemberCount((int) memberRepository.countActiveByDemandId(demandId));
        demandRepository.save(demand);

        notify(demand.getLeader(), "A member left your group demand",
                "'" + shortText(demand.getProduct().getName(), 60) + "' is back to "
                        + demand.getCommittedQuantity() + " of " + demand.getRequiredQuantity()
                        + " unit(s).",
                "/group-reverse-demands/" + demandId);
        return mapper.toMemberDto(member);
    }

    @Override
    @Transactional(readOnly = true)
    public GroupReverseMemberDto getMyMembership(String customerEmail, UUID demandId) {
        User customer = requireCustomer(customerEmail);
        return memberRepository.findByDemandIdAndCustomerId(demandId, customer.getId())
                .map(mapper::toMemberDto)
                .orElse(null);
    }

    /**
     * The groups this customer joined under somebody else.
     * <p>
     * Built from the member rows, then narrowed to the demands the customer does <em>not</em> lead -
     * those belong to {@code getMyLedDemands}, and listing a group twice under both headings is how a
     * customer ends up unsure which one is the one where they hold the decision.
     */
    @Override
    @Transactional(readOnly = true)
    public List<GroupReverseDemandDto> getMyJoinedDemands(String customerEmail) {
        User customer = requireCustomer(customerEmail);
        LocalDateTime now = LocalDateTime.now();
        List<GroupReverseDemand> demands = new ArrayList<>();
        for (GroupReverseMember member : memberRepository
                .findByCustomerIdOrderByJoinedAtDesc(customer.getId())) {
            GroupReverseDemand demand = member.getDemand();
            if (!demand.getLeader().getId().equals(customer.getId())
                    && demands.stream().noneMatch(seen -> seen.getId().equals(demand.getId()))) {
                demands.add(demand);
            }
        }
        return demands.stream().map(demand -> {
            GroupReverseDemandDto dto = mapper.toDemandDto(demand, now);
            dto.setLeader(false);
            dto.setMyMembership(memberRepository
                    .findByDemandIdAndCustomerId(demand.getId(), customer.getId())
                    .map(mapper::toMemberDto)
                    .orElse(null));
            return dto;
        }).toList();
    }

    // ---- Target reached ---------------------------------------------------------------------------

    /**
     * Moves an OPEN demand whose target has just been met into the seller round.
     * <p>
     * Both {@code TARGET_REACHED} and {@code READY_FOR_OFFERS} are set, in that order, inside this one
     * transaction. The intermediate state is recorded through {@code targetReachedAt} rather than
     * being held as a resting status, because a met target has to open the seller marketplace
     * immediately - making sellers wait for the next scheduler sweep would be a defect, not a
     * feature.
     */
    private void reachTarget(GroupReverseDemand demand, LocalDateTime now) {
        demand.setStatus(GroupReverseDemandStatus.TARGET_REACHED);
        demand.setTargetReachedAt(now);
        // Joining is closed from here on: the group quantity is frozen at exactly what it needed.
        demand.setStatus(GroupReverseDemandStatus.READY_FOR_OFFERS);
        demandRepository.save(demand);

        notify(demand.getLeader(), "Your group is complete - sellers can now bid",
                "'" + shortText(demand.getProduct().getName(), 60) + "' reached "
                        + demand.getCommittedQuantity() + " units across " + demand.getMemberCount()
                        + " customers. Sellers can now submit offers until "
                        + demand.getOfferDeadline() + ".",
                "/group-reverse-demands/" + demand.getId() + "/offers");
    }

    private String joinRefusal(GroupReverseDemand demand, LocalDateTime now) {
        if (demand.getStatus() == GroupReverseDemandStatus.DRAFT) {
            return "This demand has not been published yet.";
        }
        if (demand.isTargetReached()) {
            return "This group has already reached its target quantity, so joining is closed.";
        }
        if (demand.getStatus().isTerminal()) {
            return "This group demand has ended (" + demand.getStatus().name().replace('_', ' ') + ").";
        }
        return "This group demand is not accepting members right now.";
    }

    private PaymentMethod parsePaymentMethod(String value) {
        if (value == null || value.isBlank()) {
            throw bad("A payment method is required.");
        }
        PaymentMethod method;
        try {
            method = PaymentMethod.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw bad("'" + value + "' is not a payment method.");
        }
        if (!PAYABLE.contains(method)) {
            throw bad("A group purchase can only be paid for by " + PAYABLE + ".");
        }
        return method;
    }

    private User requireCustomer(String email) {
        if (email == null) {
            throw new ApiException("You must be signed in", HttpStatus.UNAUTHORIZED);
        }
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
        if (!user.isEnabled()) {
            throw new ApiException("This account is disabled", HttpStatus.FORBIDDEN);
        }
        return user;
    }

    private void notify(User recipient, String title, String message, String link) {
        if (recipient == null) {
            return;
        }
        notificationService.sendNotification(com.groupmart.dto.notification.SendNotificationRequest
                .builder()
                .userId(recipient.getId())
                .title(shortText(title, 150))
                .message(shortText(message, 1000))
                .type(NOTIFICATION_TYPE)
                .link(link)
                .build());
    }

    private static String shortText(String text, int max) {
        if (text == null) {
            return null;
        }
        return text.length() <= max ? text : text.substring(0, max - 1) + "...";
    }

    private static ApiException bad(String message) {
        return new ApiException(message, HttpStatus.BAD_REQUEST);
    }
}
