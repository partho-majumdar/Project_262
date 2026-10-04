package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.groupmart.dto.groupbuy.*;
import com.groupmart.entity.*;
import com.groupmart.repository.GroupBuyActivityRepository;
import com.groupmart.repository.GroupBuyGroupRepository;
import com.groupmart.repository.GroupBuyParticipantRepository;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static com.groupmart.service.impl.GroupBuyEventRecorder.displayName;
import static com.groupmart.service.impl.GroupBuyEventRecorder.money;

@Component
@RequiredArgsConstructor
public class GroupBuyMapper {

    private final GroupBuyGroupRepository groupRepository;
    private final GroupBuyParticipantRepository participantRepository;
    private final GroupBuyActivityRepository activityRepository;

    public GroupBuyCampaignDto toCampaignDto(GroupBuyCampaign campaign) {
        Product product = campaign.getProduct();
        SellerStore store = campaign.getSellerStore();
        BigDecimal lowest = GroupBuyPricing.lowestPrice(campaign);

        long openGroups = 0;
        long successfulGroups = 0;
        long failedGroups = 0;
        long participants = 0;
        if (campaign.getId() != null) {
            for (Object[] row : groupRepository.aggregateByCampaign(campaign.getId())) {
                GroupBuyGroupStatus status = (GroupBuyGroupStatus) row[0];
                long groups = ((Number) row[1]).longValue();
                long members = ((Number) row[2]).longValue();
                switch (status) {
                    case OPEN -> {
                        openGroups += groups;
                        participants += members;
                    }
                    case SUCCESS -> {
                        successfulGroups += groups;
                        participants += members;
                    }
                    default -> failedGroups += groups;
                }
            }
        }

        List<String> images = product.getImageUrls() != null ? new ArrayList<>(product.getImageUrls()) : List.of();

        return GroupBuyCampaignDto.builder()
                .id(campaign.getId())
                .productId(product.getId())
                .productName(product.getName())
                .productSlug(product.getSlug())
                .productImageUrl(images.isEmpty() ? null : images.get(0))
                .productImageUrls(images)
                .categoryName(product.getCategory() != null ? product.getCategory().getName() : null)
                .categorySlug(product.getCategory() != null ? product.getCategory().getSlug() : null)
                .productStock(product.getStockQuantity())
                .sellerStoreId(store.getId())
                .sellerStoreName(store.getStoreName())
                .sellerStoreSlug(store.getStoreSlug())
                .title(campaign.getTitle())
                .description(campaign.getDescription())
                .status(campaign.getStatus())
                .basePrice(campaign.getBasePrice())
                .lowestPrice(lowest)
                .maxDiscountPercent(GroupBuyPricing.discountPercent(campaign.getBasePrice(), lowest))
                .minParticipants(campaign.getMinParticipants())
                .maxParticipants(campaign.getMaxParticipants())
                .maxQuantityPerUser(campaign.getMaxQuantityPerUser())
                .reservedQuantity(campaign.getReservedQuantity())
                .availableQuantity(campaign.getAvailableQuantity())
                .soldQuantity(campaign.getSoldQuantity())
                .committedQuantity(campaign.getCommittedQuantity())
                .inventoryReserved(campaign.isInventoryReserved())
                .inventoryReleased(campaign.isInventoryReleased())
                .groupDurationHours(campaign.getGroupDurationHours())
                .startAt(campaign.getStartAt())
                .endAt(campaign.getEndAt())
                .tiers(toTierDtos(campaign, -1))
                .openGroupCount(openGroups)
                .successfulGroupCount(successfulGroups)
                .failedGroupCount(failedGroups)
                .totalParticipants(participants)
                .rejectionReason(campaign.getRejectionReason())
                .closingNote(campaign.getClosingNote())
                .closeCode(campaign.getCloseCode() != null ? campaign.getCloseCode().name() : null)
                .closeReasonLabel(campaign.getCloseCode() != null ? campaign.getCloseCode().getLabel() : null)
                .submittedAt(campaign.getSubmittedAt())
                .approvedAt(campaign.getApprovedAt())
                .closedAt(campaign.getClosedAt())
                .createdAt(campaign.getCreatedAt())
                .build();
    }

    /** Tier list with unlock flags for a group of the given size (pass -1 for none unlocked). */
    public List<GroupBuyTierDto> toTierDtos(GroupBuyCampaign campaign, int participantCount) {
        return GroupBuyPricing.sortedTiers(campaign).stream()
                .map(tier -> toTierDto(campaign, tier, participantCount))
                .toList();
    }

    public GroupBuyGroupDto toGroupDto(GroupBuyGroup group, User viewer, boolean includeDetails) {
        return toGroupDto(group, viewer, includeDetails, null);
    }

    /** Pass a precomputed campaign DTO when mapping many groups of the same campaign. */
    public GroupBuyGroupDto toGroupDto(GroupBuyGroup group, User viewer, boolean includeDetails,
                                      GroupBuyCampaignDto campaignDto) {
        GroupBuyCampaign campaign = group.getCampaign();
        LocalDateTime now = LocalDateTime.now();
        int count = group.getParticipantCount();
        int min = campaign.getMinParticipants();
        int max = campaign.getMaxParticipants();
        boolean open = group.getStatus() == GroupBuyGroupStatus.OPEN;
        BigDecimal base = campaign.getBasePrice();
        BigDecimal currentPrice = group.getFinalUnitPrice() != null
                ? group.getFinalUnitPrice()
                : GroupBuyPricing.unitPriceFor(campaign, count);
        GroupBuyPriceTier next = open ? GroupBuyPricing.nextTier(campaign, count) : null;
        int spotsToMinimum = Math.max(0, min - count);

        GroupBuyParticipant mine = viewer == null ? null
                : participantRepository.findByBuyGroupIdAndUserId(group.getId(), viewer.getId()).orElse(null);
        String joinBlockedReason = joinBlockedReason(group, campaign, viewer, mine, now);

        GroupBuyGroupDto.GroupBuyGroupDtoBuilder builder = GroupBuyGroupDto.builder()
                .id(group.getId())
                .inviteCode(group.getInviteCode())
                .status(group.getStatus())
                .campaign(campaignDto != null ? campaignDto : toCampaignDto(campaign))
                .leaderId(group.getLeader().getId())
                .leaderName(displayName(group.getLeader()))
                .startedByName(displayName(group.getStartedBy()))
                .viewerLeader(viewer != null && group.getLeader().getId().equals(viewer.getId()))
                .viewerStarted(viewer != null && group.getStartedBy().getId().equals(viewer.getId()))
                .participantCount(count)
                .minParticipants(min)
                .maxParticipants(max)
                .spotsToMinimum(spotsToMinimum)
                .spotsLeft(Math.max(0, max - count))
                .totalQuantity(group.getTotalQuantity())
                .progressPercent(min <= 0 ? 100 : Math.min(100, count * 100 / min))
                .almostThere(open && spotsToMinimum > 0 && (spotsToMinimum == 1 || count * 100 / min >= 75))
                .urgencyMessage(urgencyMessage(group, spotsToMinimum, next, count, now))
                .basePrice(base)
                .currentUnitPrice(currentPrice)
                .currentDiscountPercent(GroupBuyPricing.discountPercent(base, currentPrice))
                .nextTier(next == null ? null : toTierDto(campaign, next, count))
                .participantsToNextTier(next == null ? 0 : next.getMinParticipants() - count)
                .priceLadder(toTierDtos(campaign, count))
                .expiresAt(group.getExpiresAt())
                .completedAt(group.getCompletedAt())
                .finalUnitPrice(group.getFinalUnitPrice())
                .failureReason(group.getFailureReason())
                .joinable(joinBlockedReason == null)
                .joinBlockedReason(joinBlockedReason)
                .myMembership(mine == null ? null : toMembershipDto(mine, campaign, currentPrice))
                .createdAt(group.getCreatedAt());

        if (includeDetails) {
            UUID leaderId = group.getLeader().getId();
            builder.participants(participantRepository.findByBuyGroupIdOrderByJoinedAtAsc(group.getId()).stream()
                    .filter(p -> p.getStatus() != GroupBuyParticipantStatus.LEFT)
                    .map(p -> toParticipantDto(p, leaderId))
                    .toList());
            builder.activities(activityRepository.findTop30ByBuyGroupIdOrderByCreatedAtDesc(group.getId()).stream()
                    .map(this::toActivityDto)
                    .toList());
        }
        return builder.build();
    }

    public GroupBuyMembershipDto toMembershipDto(GroupBuyParticipant participant, GroupBuyCampaign campaign,
                                                 BigDecimal currentGroupPrice) {
        BigDecimal effectiveUnitPrice = switch (participant.getStatus()) {
            case CONVERTED -> participant.getFinalUnitPrice();
            // Price protection: a member never pays more than the price shown when they joined
            case JOINED -> currentGroupPrice.min(participant.getUnitPriceAtJoin());
            default -> null;
        };
        BigDecimal savings = effectiveUnitPrice == null
                ? BigDecimal.ZERO
                : GroupBuyPricing.lineTotal(campaign.getBasePrice().subtract(effectiveUnitPrice).max(BigDecimal.ZERO),
                participant.getQuantity());
        Order order = participant.getOrder();

        return GroupBuyMembershipDto.builder()
                .participantId(participant.getId())
                .userId(participant.getUser().getId())
                .quantity(participant.getQuantity())
                .status(participant.getStatus())
                .unitPriceAtJoin(participant.getUnitPriceAtJoin())
                .amountPaid(participant.getAmountPaid())
                .effectiveUnitPrice(effectiveUnitPrice)
                .finalUnitPrice(participant.getFinalUnitPrice())
                .refundAmount(participant.getRefundAmount())
                .savings(savings)
                .paymentStatus(participant.getPaymentStatus())
                .paymentMethod(participant.getPaymentMethod())
                .paymentReference(participant.getPaymentReference())
                .orderNumber(order != null ? order.getOrderNumber() : null)
                .orderStatus(order != null ? order.getStatus().name() : null)
                .shippingAddress(Stream.of(
                                participant.getShippingAddressLine1(),
                                participant.getShippingAddressLine2(),
                                participant.getShippingCity(),
                                participant.getShippingState(),
                                participant.getShippingPostalCode(),
                                participant.getShippingCountry())
                        .filter(Objects::nonNull)
                        .filter(part -> !part.isBlank())
                        .collect(Collectors.joining(", ")))
                .joinedAt(participant.getJoinedAt())
                .leftAt(participant.getLeftAt())
                .build();
    }

    private GroupBuyTierDto toTierDto(GroupBuyCampaign campaign, GroupBuyPriceTier tier, int participantCount) {
        BigDecimal base = campaign.getBasePrice();
        return GroupBuyTierDto.builder()
                .minParticipants(tier.getMinParticipants())
                .unitPrice(tier.getUnitPrice())
                .discountPercent(GroupBuyPricing.discountPercent(base, tier.getUnitPrice()))
                .savingsPerUnit(base.subtract(tier.getUnitPrice()).max(BigDecimal.ZERO))
                .unlocked(participantCount >= tier.getMinParticipants())
                .build();
    }

    private GroupBuyParticipantDto toParticipantDto(GroupBuyParticipant participant, UUID leaderId) {
        User user = participant.getUser();
        String first = user.getFirstName();
        return GroupBuyParticipantDto.builder()
                .id(participant.getId())
                .displayName(displayName(user))
                .initial(first != null && !first.isBlank() ? first.substring(0, 1).toUpperCase() : "?")
                .leader(user.getId().equals(leaderId))
                .invited(participant.getInvitedBy() != null)
                .quantity(participant.getQuantity())
                .status(participant.getStatus())
                .joinedAt(participant.getJoinedAt())
                .build();
    }

    private GroupBuyActivityDto toActivityDto(GroupBuyActivity activity) {
        return GroupBuyActivityDto.builder()
                .type(activity.getType())
                .message(activity.getMessage())
                .actorName(activity.getActor() != null ? displayName(activity.getActor()) : null)
                .createdAt(activity.getCreatedAt())
                .build();
    }

    private String joinBlockedReason(GroupBuyGroup group, GroupBuyCampaign campaign, User viewer,
                                     GroupBuyParticipant mine, LocalDateTime now) {
        if (group.getStatus() != GroupBuyGroupStatus.OPEN) {
            return "This group has closed.";
        }
        if (!group.getExpiresAt().isAfter(now)) {
            return "This group's timer has ended.";
        }
        if (campaign.getStatus() == GroupBuyCampaignStatus.PAUSED) {
            return "This group buy is temporarily paused by the seller.";
        }
        if (campaign.getStatus() != GroupBuyCampaignStatus.ACTIVE) {
            return "This group buy is not accepting participants.";
        }
        if (group.getParticipantCount() >= campaign.getMaxParticipants()) {
            return "This group is full.";
        }
        if (viewer != null) {
            if (mine != null && mine.getStatus() == GroupBuyParticipantStatus.JOINED) {
                return "You're already in this group.";
            }
            if (campaign.getSellerStore().getUser().getId().equals(viewer.getId())) {
                return "You can't join a group buy for your own product.";
            }
            boolean inAnotherGroup = participantRepository
                    .findActiveGroupIdsInCampaign(viewer.getId(), campaign.getId()).stream()
                    .anyMatch(id -> !id.equals(group.getId()));
            if (inAnotherGroup) {
                return "You're already in another active group for this deal.";
            }
        }
        if (campaign.getAvailableQuantity() <= 0) {
            return "All reserved units for this deal are taken.";
        }
        return null;
    }

    private String urgencyMessage(GroupBuyGroup group, int spotsToMinimum, GroupBuyPriceTier next,
                                  int count, LocalDateTime now) {
        if (group.getStatus() != GroupBuyGroupStatus.OPEN) {
            return null;
        }
        long minutesLeft = Duration.between(now, group.getExpiresAt()).toMinutes();
        if (spotsToMinimum == 1) {
            return "Almost there! Just 1 more person needed to unlock this deal.";
        }
        if (spotsToMinimum > 1 && minutesLeft <= 120) {
            return "Hurry! " + spotsToMinimum + " more people needed and less than "
                    + (minutesLeft <= 60 ? "an hour" : "2 hours") + " left.";
        }
        if (spotsToMinimum == 0 && next != null) {
            int more = next.getMinParticipants() - count;
            return "Goal reached! " + more + (more == 1 ? " more person unlocks " : " more people unlock ")
                    + money(next.getUnitPrice()) + " each.";
        }
        if (spotsToMinimum == 0) {
            return "Goal reached! Orders will be placed when the timer ends.";
        }
        return null;
    }
}
