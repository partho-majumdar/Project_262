package com.groupmart.service.impl;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.groupr.CreateGroupReverseDemandRequest;
import com.groupmart.dto.groupr.GroupReverseDemandDto;
import com.groupmart.dto.groupr.GroupReverseMemberDto;
import com.groupmart.dto.groupr.UpdateGroupReverseDemandRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.GroupReverseDemandService;
import com.groupmart.service.NotificationService;

/**
 * Creation and lifecycle of customer-created group purchasing demands.
 * <p>
 * A distinct mechanism from {@link com.groupmart.service.impl.ReverseGroupBuyingCampaignServiceImpl}:
 * there a seller declares a target and a price and customers supply demand to unlock it, here a
 * customer declares the quantity and the acceptable price and sellers compete to win the business.
 * <p>
 * Nothing is reserved in inventory while a demand is open, because no seller is committed yet -
 * stock is taken at the moment an offer is accepted.
 */
@Service
@RequiredArgsConstructor
public class GroupReverseDemandServiceImpl implements GroupReverseDemandService {

    private static final String NOTIFICATION_TYPE = "GROUP_REVERSE";

    private final GroupReverseDemandRepository demandRepository;
    private final GroupReverseMemberRepository memberRepository;
    private final GroupReverseOfferRepository offerRepository;
    private final UserRepository userRepository;
    private final SellerStoreRepository sellerStoreRepository;
    private final ProductRepository productRepository;
    private final NotificationService notificationService;
    private final GroupReverseMapper mapper;

    @Override
    @Transactional
    public GroupReverseDemandDto createDemand(String leaderEmail, CreateGroupReverseDemandRequest request) {
        User leader = requireCustomer(leaderEmail);
        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", request.getProductId()));

        validateTerms(request.getRequiredQuantity(), request.getMinQuantityPerMember(),
                request.getMaxQuantityPerMember(), request.getTargetPrice(), request.getMaxPrice(),
                request.getJoinDeadline(), request.getOfferDeadline());

        // The creator joins as an ordinary member. The leader holds selection authority, but is still
        // a buyer of their own quantity - never a stand-in for anybody else's.
        GroupReverseDemand demand = GroupReverseDemand.builder()
                .product(product)
                .leader(leader)
                .description(request.getDescription())
                .status(GroupReverseDemandStatus.DRAFT)
                .requiredQuantity(request.getRequiredQuantity())
                .targetPrice(request.getTargetPrice())
                .maxPrice(request.getMaxPrice())
                .minQuantityPerMember(request.getMinQuantityPerMember())
                .maxQuantityPerMember(request.getMaxQuantityPerMember())
                .joinDeadline(request.getJoinDeadline())
                .offerDeadline(request.getOfferDeadline())
                .deliveryCity(request.getDeliveryCity())
                .requiredDeliveryDate(request.getRequiredDeliveryDate())
                .build();
        GroupReverseDemand saved = demandRepository.save(demand);

        notify(leader, "Group demand created",
                "'" + shortText(product.getName(), 60) + "': your group demand for "
                        + saved.getRequiredQuantity() + " units is saved as a draft. Publish it to let "
                        + "other customers join.",
                "/group-reverse-demands/" + saved.getId());
        return mapper.toDemandDto(saved, LocalDateTime.now());
    }

    @Override
    @Transactional
    public GroupReverseDemandDto updateDemand(String leaderEmail, UUID demandId,
                                              UpdateGroupReverseDemandRequest request) {
        GroupReverseDemand demand = requireOwned(leaderEmail, demandId);
        if (demand.getStatus() != GroupReverseDemandStatus.DRAFT) {
            throw bad("Only a draft demand can be edited. Once published, the quantity and deadlines are "
                    + "what other customers have already committed against.");
        }
        // Re-run the same cross-field validation the create path uses, so an edit cannot smuggle in a
        // combination the create endpoint would have rejected.
        validateTerms(
                demand.getRequiredQuantity(),
                firstNonNull(request.getMinQuantityPerMember(), demand.getMinQuantityPerMember()),
                firstNonNull(request.getMaxQuantityPerMember(), demand.getMaxQuantityPerMember()),
                firstNonNull(request.getTargetPrice(), demand.getTargetPrice()),
                firstNonNull(request.getMaxPrice(), demand.getMaxPrice()),
                firstNonNull(request.getJoinDeadline(), demand.getJoinDeadline()),
                firstNonNull(request.getOfferDeadline(), demand.getOfferDeadline()));

        if (request.getDescription() != null) {
            demand.setDescription(request.getDescription());
        }
        if (request.getTargetPrice() != null) {
            demand.setTargetPrice(request.getTargetPrice());
        }
        if (request.getMaxPrice() != null) {
            demand.setMaxPrice(request.getMaxPrice());
        }
        if (request.getMinQuantityPerMember() != null) {
            demand.setMinQuantityPerMember(request.getMinQuantityPerMember());
        }
        if (request.getMaxQuantityPerMember() != null) {
            demand.setMaxQuantityPerMember(request.getMaxQuantityPerMember());
        }
        if (request.getJoinDeadline() != null) {
            demand.setJoinDeadline(request.getJoinDeadline());
        }
        if (request.getOfferDeadline() != null) {
            demand.setOfferDeadline(request.getOfferDeadline());
        }
        if (request.getDeliveryCity() != null) {
            demand.setDeliveryCity(request.getDeliveryCity());
        }
        if (request.getRequiredDeliveryDate() != null) {
            demand.setRequiredDeliveryDate(request.getRequiredDeliveryDate());
        }
        return mapper.toDemandDto(demandRepository.save(demand), LocalDateTime.now());
    }

    @Override
    @Transactional
    public GroupReverseDemandDto publishDemand(String leaderEmail, UUID demandId) {
        GroupReverseDemand demand = requireOwned(leaderEmail, demandId);
        if (demand.getStatus() != GroupReverseDemandStatus.DRAFT) {
            throw bad("This demand has already been published.");
        }
        LocalDateTime now = LocalDateTime.now();
        if (!demand.getJoinDeadline().isAfter(now)) {
            throw bad("The join deadline is already in the past, so nobody could ever join.");
        }
        demand.setStatus(GroupReverseDemandStatus.OPEN);
        demand.setPublishedAt(now);
        return mapper.toDemandDto(demandRepository.save(demand), now);
    }

    @Override
    @Transactional(readOnly = true)
    public GroupReverseDemandDto getDemand(String requesterEmail, UUID demandId) {
        GroupReverseDemand demand = demandRepository.findById(demandId)
                .orElseThrow(() -> new ResourceNotFoundException("Group demand", "id", demandId));
        LocalDateTime now = LocalDateTime.now();
        GroupReverseDemandDto dto = mapper.toDemandDto(demand, now);

        User requester = requesterEmail == null ? null : userRepository.findByEmail(requesterEmail).orElse(null);
        dto.setLeader(requester != null && demand.getLeader().getId().equals(requester.getId()));
        if (requester != null) {
            memberRepository.findByDemandIdAndCustomerId(demandId, requester.getId())
                    .ifPresent(member -> dto.setMyMembership(mapper.toMemberDto(member)));
        }
        return dto;
    }

    @Override
    @Transactional(readOnly = true)
    public List<GroupReverseDemandDto> discoverDemands(String requesterEmail) {
        User requester = requesterEmail == null ? null
                : userRepository.findByEmail(requesterEmail).orElse(null);
        List<GroupReverseDemand> demands = demandRepository.findDiscoverable(List.of(
                GroupReverseDemandStatus.OPEN,
                GroupReverseDemandStatus.TARGET_REACHED,
                GroupReverseDemandStatus.READY_FOR_OFFERS,
                GroupReverseDemandStatus.OFFERS_RECEIVED,
                GroupReverseDemandStatus.OFFER_SELECTED,
                GroupReverseDemandStatus.ORDERS_CREATED,
                GroupReverseDemandStatus.FULFILLING));
        LocalDateTime now = LocalDateTime.now();
        return demands.stream().map(demand -> {
            GroupReverseDemandDto dto = mapper.toDemandDto(demand, now);
            if (requester != null) {
                dto.setLeader(demand.getLeader().getId().equals(requester.getId()));
                memberRepository.findByDemandIdAndCustomerId(demand.getId(), requester.getId())
                        .ifPresent(member -> dto.setMyMembership(mapper.toMemberDto(member)));
            }
            return dto;
        }).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<GroupReverseDemandDto> getMyLedDemands(String leaderEmail) {
        User leader = requireCustomer(leaderEmail);
        LocalDateTime now = LocalDateTime.now();
        return demandRepository.findByLeaderIdOrderByCreatedAtDesc(leader.getId()).stream()
                .map(demand -> {
                    GroupReverseDemandDto dto = mapper.toDemandDto(demand, now);
                    dto.setLeader(true);
                    // A leader may also have joined as an ordinary member; the card shows their share too.
                    memberRepository.findByDemandIdAndCustomerId(demand.getId(), leader.getId())
                            .ifPresent(member -> dto.setMyMembership(mapper.toMemberDto(member)));
                    return dto;
                })
                .toList();
    }

    @Override
    @Transactional
    public GroupReverseDemandDto cancelDemand(String leaderEmail, UUID demandId, String reason) {
        GroupReverseDemand demand = requireOwned(leaderEmail, demandId);
        return voidDemand(demand, reason != null && !reason.isBlank() ? reason
                : "Cancelled by the demand creator", GroupReverseCloseCode.LEADER_CANCELLED);
    }

    @Override
    @Transactional
    public GroupReverseDemandDto cancelByAdmin(UUID demandId, String adminEmail, String reason) {
        User admin = userRepository.findByEmail(adminEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", adminEmail));
        if (admin.getRole() != Role.ROLE_ADMIN) {
            throw new ApiException("Only an administrator can cancel a group demand",
                    HttpStatus.FORBIDDEN);
        }
        GroupReverseDemand demand = demandRepository.findByIdForUpdate(demandId)
                .orElseThrow(() -> new ResourceNotFoundException("Group demand", "id", demandId));
        return voidDemand(demand, reason != null && !reason.isBlank() ? reason
                : "Cancelled by an administrator", GroupReverseCloseCode.ADMIN_CANCELLED);
    }

    /**
     * The single implementation of "this group demand is dead": freeze the status, release every
     * member's reservation, and close any bid still on the table. Shared by the leader and the
     * admin so the two paths cannot drift apart.
     */
    private GroupReverseDemandDto voidDemand(GroupReverseDemand demand, String reasonText,
                                             GroupReverseCloseCode code) {
        if (demand.getStatus().isTerminal()) {
            return mapper.toDemandDto(demand, LocalDateTime.now());
        }
        if (demand.getStatus().isLocked()) {
            // Past selection the group is committed; members leave through ordinary order
            // cancellation, and the accepted price is nobody else's to change.
            throw bad("An offer has already been selected for this group, so the demand can no longer be "
                    + "cancelled. Members can cancel their individual orders instead.");
        }

        String note = shortText(reasonText, 500);
        demand.setStatus(GroupReverseDemandStatus.CANCELLED);
        demand.setCloseCode(code);
        demand.setCloseNote(note);
        demand.setClosedAt(LocalDateTime.now());
        GroupReverseDemand saved = demandRepository.save(demand);

        // Tell every member their commitment is void, and close any offers still on the table.
        List<GroupReverseMember> members = memberRepository.findByDemandIdOrderByJoinedAtAsc(saved.getId());
        for (GroupReverseMember member : members) {
            if (member.getStatus().isActive()) {
                member.setStatus(GroupReverseMemberStatus.CANCELLED);
                member.setCancelledAt(LocalDateTime.now());
                member.setCancellationReason(note);
                memberRepository.save(member);
                notify(member.getCustomer(), "Group demand cancelled",
                        "'" + shortText(saved.getProduct().getName(), 60) + "' was cancelled: " + note
                                + " Your reserved quantity has been released.",
                        "/group-reverse-demands/" + saved.getId());
            }
        }
        closeOutstandingOffers(saved.getId(), note);
        return mapper.toDemandDto(saved, LocalDateTime.now());
    }

    @Override
    @Transactional(readOnly = true)
    public List<GroupReverseMemberDto> getMembers(String requesterEmail, UUID demandId) {
        GroupReverseDemand demand = demandRepository.findById(demandId)
                .orElseThrow(() -> new ResourceNotFoundException("Group demand", "id", demandId));
        User requester = requireCustomer(requesterEmail);
        boolean isLeader = demand.getLeader().getId().equals(requester.getId());
        boolean isMember = memberRepository
                .findByDemandIdAndCustomerId(demandId, requester.getId()).isPresent();

        // A member sees only their own record. The leader sees the roster, because picking a seller
        // responsibly means knowing who the group is.
        if (!isLeader) {
            if (!isMember) {
                throw new ApiException("You are not a member of this group demand", HttpStatus.FORBIDDEN);
            }
            return memberRepository.findByDemandIdAndCustomerId(demandId, requester.getId())
                    .map(mapper::toMemberDto).map(List::of).orElseGet(List::of);
        }
        return memberRepository.findByDemandIdOrderByJoinedAtAsc(demandId).stream()
                .map(mapper::toMemberDto)
                .toList();
    }

    // ---- Shared helpers, also used by the participation and offer services ----------------------

    /** Closes every offer still awaiting a decision, telling each seller what happened. */
    private void closeOutstandingOffers(UUID demandId, String note) {
        for (GroupReverseOffer offer : offerRepository.findByDemandIdAndStatus(demandId,
                GroupReverseOfferStatus.SUBMITTED)) {
            offer.setStatus(GroupReverseOfferStatus.CLOSED);
            offer.setClosedAt(LocalDateTime.now());
            offer.setCloseNote(shortText(note, 500));
            offerRepository.save(offer);
            User owner = offer.getSellerStore().getUser();
            if (owner != null) {
                notify(owner, "Your group offer was closed",
                        "The group demand this offer targeted is no longer running. Reason: " + note,
                        "/seller/dashboard?tab=group-reverse");
            }
        }
    }

    private void validateTerms(Integer requiredQuantity, Integer minPerMember, Integer maxPerMember,
                               BigDecimal targetPrice, BigDecimal maxPrice,
                               LocalDateTime joinDeadline, LocalDateTime offerDeadline) {
        if (requiredQuantity == null || minPerMember == null || maxPerMember == null) {
            throw bad("Quantity terms are required.");
        }
        if (requiredQuantity < 2) {
            throw bad("A group demand needs at least 2 units, otherwise there is no group to form.");
        }
        if (minPerMember < 1) {
            throw bad("The minimum member quantity must be at least 1.");
        }
        if (maxPerMember < minPerMember) {
            throw bad("The maximum member quantity cannot be below the minimum.");
        }
        if (minPerMember > requiredQuantity) {
            throw bad("The minimum member quantity cannot exceed the total required quantity.");
        }
        if (targetPrice == null || targetPrice.signum() <= 0) {
            throw bad("The target price must be greater than zero.");
        }
        if (maxPrice != null) {
            if (maxPrice.signum() <= 0) {
                throw bad("The maximum price must be greater than zero.");
            }
            if (maxPrice.compareTo(targetPrice) < 0) {
                throw bad("The maximum price cannot be lower than the target price.");
            }
        }
        LocalDateTime now = LocalDateTime.now();
        if (joinDeadline == null || !joinDeadline.isAfter(now)) {
            throw bad("The join deadline must be in the future.");
        }
        if (offerDeadline == null || !offerDeadline.isAfter(joinDeadline)) {
            throw bad("The offer deadline must be after the join deadline, so sellers can bid once the "
                    + "group has actually formed.");
        }
    }

    private GroupReverseDemand requireOwned(String email, UUID demandId) {
        GroupReverseDemand demand = demandRepository.findById(demandId)
                .orElseThrow(() -> new ResourceNotFoundException("Group demand", "id", demandId));
        User user = requireCustomer(email);
        if (!demand.getLeader().getId().equals(user.getId())) {
            throw new ApiException("Only the demand creator can do that", HttpStatus.FORBIDDEN);
        }
        return demand;
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

    private static <T> T firstNonNull(T candidate, T fallback) {
        return candidate != null ? candidate : fallback;
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
