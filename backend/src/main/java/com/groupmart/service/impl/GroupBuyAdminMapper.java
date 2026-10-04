package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.groupmart.dto.groupbuy.GroupBuyDisputeDto;
import com.groupmart.dto.groupbuy.admin.AdminGroupBuyActivityDto;
import com.groupmart.dto.groupbuy.admin.AdminGroupBuyParticipantDto;
import com.groupmart.entity.*;
import com.groupmart.repository.GroupBuyDisputeRepository;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/** Maps group buy entities to the admin views, which show full names, emails and payment details. */
@Component
@RequiredArgsConstructor
public class GroupBuyAdminMapper {

    private final GroupBuyDisputeRepository disputeRepository;

    public AdminGroupBuyParticipantDto toParticipantDto(GroupBuyParticipant participant) {
        User user = participant.getUser();
        GroupBuyGroup group = participant.getBuyGroup();
        GroupBuyCampaign campaign = group.getCampaign();
        User inviter = participant.getInvitedBy();
        Order order = participant.getOrder();
        BigDecimal refund = orZero(participant.getRefundAmount());

        return AdminGroupBuyParticipantDto.builder()
                .id(participant.getId())
                .userId(user.getId())
                .customerName(fullName(user))
                .customerEmail(user.getEmail())
                .accountCreatedAt(user.getCreatedAt())
                .accountEnabled(user.isEnabled())
                .campaignId(campaign.getId())
                .campaignTitle(campaign.getTitle())
                .productName(campaign.getProduct().getName())
                .sellerStoreName(campaign.getSellerStore().getStoreName())
                .groupId(group.getId())
                .inviteCode(group.getInviteCode())
                .groupStatus(group.getStatus())
                .leader(group.getLeader().getId().equals(user.getId()))
                .invitedByName(inviter != null ? fullName(inviter) : null)
                .invitedByEmail(inviter != null ? inviter.getEmail() : null)
                .quantity(participant.getQuantity())
                .unitPriceAtJoin(participant.getUnitPriceAtJoin())
                .amountPaid(participant.getAmountPaid())
                .finalUnitPrice(participant.getFinalUnitPrice())
                .refundAmount(refund)
                .netPaid(orZero(participant.getAmountPaid()).subtract(refund).max(BigDecimal.ZERO))
                .status(participant.getStatus())
                .paymentStatus(participant.getPaymentStatus())
                .paymentMethod(participant.getPaymentMethod())
                .paymentReference(participant.getPaymentReference())
                .orderId(order != null ? order.getId() : null)
                .orderNumber(order != null ? order.getOrderNumber() : null)
                .orderStatus(order != null ? order.getStatus().name() : null)
                .orderTotal(order != null ? order.getTotalAmount() : null)
                .orderCreatedAt(order != null ? order.getCreatedAt() : null)
                .shippingAddress(shippingAddress(participant))
                .joinedAt(participant.getJoinedAt())
                .leftAt(participant.getLeftAt())
                .build();
    }

    public AdminGroupBuyActivityDto toActivityDto(GroupBuyActivity activity) {
        GroupBuyGroup group = activity.getBuyGroup();
        User actor = activity.getActor();
        return AdminGroupBuyActivityDto.builder()
                .id(activity.getId())
                .type(activity.getType())
                .message(activity.getMessage())
                .actorName(actor != null ? fullName(actor) : null)
                .actorEmail(actor != null ? actor.getEmail() : null)
                .groupId(group.getId())
                .inviteCode(group.getInviteCode())
                .campaignId(group.getCampaign().getId())
                .campaignTitle(group.getCampaign().getTitle())
                .createdAt(activity.getCreatedAt())
                .build();
    }

    public GroupBuyDisputeDto toDisputeDto(GroupBuyDispute dispute) {
        GroupBuyParticipant participant = dispute.getParticipant();
        GroupBuyGroup group = participant.getBuyGroup();
        GroupBuyCampaign campaign = group.getCampaign();
        User customer = dispute.getRaisedBy();
        Order order = participant.getOrder();
        BigDecimal disputeRefunds = orZero(disputeRepository.sumRefundsByParticipant(participant.getId()));

        return GroupBuyDisputeDto.builder()
                .id(dispute.getId())
                .type(dispute.getType())
                .typeLabel(dispute.getType().getLabel())
                .status(dispute.getStatus())
                .description(dispute.getDescription())
                .resolutionNote(dispute.getResolutionNote())
                .refundAmount(orZero(dispute.getRefundAmount()))
                .participantId(participant.getId())
                .customerId(customer.getId())
                .customerName(fullName(customer))
                .customerEmail(customer.getEmail())
                .campaignId(campaign.getId())
                .campaignTitle(campaign.getTitle())
                .productName(campaign.getProduct().getName())
                .sellerStoreName(campaign.getSellerStore().getStoreName())
                .groupId(group.getId())
                .inviteCode(group.getInviteCode())
                .groupStatus(group.getStatus())
                .participantStatus(participant.getStatus())
                .quantity(participant.getQuantity())
                .amountPaid(participant.getAmountPaid())
                .refundedSoFar(orZero(participant.getRefundAmount()).add(disputeRefunds))
                .maxRefundable(maxRefundable(participant, disputeRefunds))
                .orderNumber(order != null ? order.getOrderNumber() : null)
                .orderStatus(order != null ? order.getStatus().name() : null)
                .handledByName(dispute.getHandledBy() != null ? fullName(dispute.getHandledBy()) : null)
                .resolvedAt(dispute.getResolvedAt())
                .createdAt(dispute.getCreatedAt())
                .updatedAt(dispute.getUpdatedAt())
                .build();
    }

    /**
     * Only members with an order still hold money: open-group payments are refunded by leaving,
     * and failed or cancelled groups were already refunded in full.
     */
    public static BigDecimal maxRefundable(GroupBuyParticipant participant, BigDecimal disputeRefunds) {
        if (participant.getStatus() != GroupBuyParticipantStatus.CONVERTED || participant.getOrder() == null) {
            return BigDecimal.ZERO;
        }
        return orZero(participant.getAmountPaid())
                .subtract(orZero(participant.getRefundAmount()))
                .subtract(orZero(disputeRefunds))
                .max(BigDecimal.ZERO);
    }

    public static String fullName(User user) {
        if (user == null) {
            return null;
        }
        String name = Stream.of(user.getFirstName(), user.getLastName())
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(part -> !part.isEmpty())
                .collect(Collectors.joining(" "));
        return name.isEmpty() ? user.getEmail() : name;
    }

    public static String shippingAddress(GroupBuyParticipant participant) {
        return Stream.of(
                        participant.getShippingAddressLine1(),
                        participant.getShippingAddressLine2(),
                        participant.getShippingCity(),
                        participant.getShippingState(),
                        participant.getShippingPostalCode(),
                        participant.getShippingCountry())
                .filter(Objects::nonNull)
                .filter(part -> !part.isBlank())
                .collect(Collectors.joining(", "));
    }

    public static BigDecimal orZero(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }
}
