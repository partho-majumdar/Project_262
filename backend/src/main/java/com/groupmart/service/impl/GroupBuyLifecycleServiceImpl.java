package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.DeliveryEstimateService;
import com.groupmart.service.GroupBuyLifecycleService;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static com.groupmart.service.impl.GroupBuyEventRecorder.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class GroupBuyLifecycleServiceImpl implements GroupBuyLifecycleService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final GroupBuyCampaignRepository campaignRepository;
    private final GroupBuyGroupRepository groupRepository;
    private final GroupBuyParticipantRepository participantRepository;
    private final ProductRepository productRepository;
    private final InventoryLogRepository inventoryLogRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final DeliveryEstimateService deliveryEstimateService;
    private final GroupBuyEventRecorder events;
    private final GroupBuyDealAlerts dealAlerts;

    @Override
    @Transactional
    public void activateCampaign(UUID campaignId, boolean triggeredBySchedule) {
        GroupBuyCampaign campaign = lockCampaign(campaignId);
        GroupBuyCampaignStatus status = campaign.getStatus();
        if (status != GroupBuyCampaignStatus.DRAFT
                && status != GroupBuyCampaignStatus.SCHEDULED
                && status != GroupBuyCampaignStatus.PAUSED) {
            throw new ApiException("Campaign cannot be activated from status " + status, HttpStatus.BAD_REQUEST);
        }

        LocalDateTime now = LocalDateTime.now();
        User seller = campaign.getSellerStore().getUser();
        String title = shortText(campaign.getTitle(), 80);

        if (!campaign.getEndAt().isAfter(now)) {
            if (!triggeredBySchedule) {
                throw new ApiException("This campaign's end time has already passed", HttpStatus.BAD_REQUEST);
            }
            cancelLocked(campaign, "Campaign window ended before it could start", GroupBuyCloseCode.CAMPAIGN_WINDOW_ENDED);
            return;
        }

        if (!campaign.isInventoryReserved()) {
            Product product = campaign.getProduct();
            int quantity = campaign.getReservedQuantity();
            Integer before = productRepository.findStockQuantityById(product.getId());
            if (productRepository.decrementStockIfAvailable(product.getId(), quantity) == 0) {
                String message = "Not enough stock to reserve " + quantity + " units of '"
                        + shortText(product.getName(), 60) + "' (in stock: " + before + ")";
                if (!triggeredBySchedule) {
                    throw new ApiException(message, HttpStatus.BAD_REQUEST);
                }
                campaign.setStatus(GroupBuyCampaignStatus.PAUSED);
                events.notify(seller, "Group buy could not start",
                        message + ". Restock the product, then resume '" + title + "'.",
                        "GROUP_BUY_CAMPAIGN", SELLER_LINK);
                return;
            }
            logInventory(campaign, before, -quantity, "GROUP_BUY_RESERVE");
            campaign.setInventoryReserved(true);
        }

        campaign.setStatus(GroupBuyCampaignStatus.ACTIVE);
        dealAlerts.dealLive(campaign, status == GroupBuyCampaignStatus.PAUSED);
        if (campaign.getApprovedAt() == null) {
            campaign.setApprovedAt(now);
        }
        events.notify(seller, "Group buy is live",
                "'" + title + "' is now accepting groups until " + formatTime(campaign.getEndAt()) + ".",
                "GROUP_BUY_CAMPAIGN", SELLER_LINK);
    }

    @Override
    @Transactional
    public void settleGroup(UUID groupId) {
        UUID campaignId = groupRepository.findCampaignIdByGroupId(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyGroup", "id", groupId));
        GroupBuyCampaign campaign = lockCampaign(campaignId);
        GroupBuyGroup group = lockGroup(groupId);
        settleLocked(campaign, group, false, null);
    }

    @Override
    @Transactional
    public void closeCampaign(UUID campaignId, String note) {
        GroupBuyCampaign campaign = lockCampaign(campaignId);
        GroupBuyCampaignStatus status = campaign.getStatus();
        if (status.isTerminal()) {
            return;
        }
        if (status != GroupBuyCampaignStatus.ACTIVE && status != GroupBuyCampaignStatus.PAUSED) {
            // Never went live, so there is nothing to settle. Only an administrator closes a campaign early.
            cancelLocked(campaign, note != null ? note : "Closed before launch", GroupBuyCloseCode.CANCELLED_BY_ADMIN);
            return;
        }

        for (UUID groupId : groupRepository.findOpenGroupIdsByCampaign(campaignId)) {
            settleLocked(campaign, lockGroup(groupId), true, note);
        }

        long successfulGroups = groupRepository.countByCampaignIdAndStatus(campaignId, GroupBuyGroupStatus.SUCCESS);
        campaign.setStatus(successfulGroups > 0 ? GroupBuyCampaignStatus.SUCCESS : GroupBuyCampaignStatus.FAILED);
        campaign.setClosedAt(LocalDateTime.now());
        if (note != null) {
            campaign.setClosingNote(note);
        }
        releaseInventory(campaign);
        dealAlerts.dealEnded(campaign);

        events.notify(campaign.getSellerStore().getUser(),
                successfulGroups > 0 ? "Group buy campaign completed" : "Group buy campaign ended",
                "'" + shortText(campaign.getTitle(), 80) + "' ended with " + successfulGroups
                        + " successful group(s) and " + campaign.getSoldQuantity() + " unit(s) sold.",
                "GROUP_BUY_CAMPAIGN", SELLER_LINK);
    }

    @Override
    @Transactional
    public void cancelCampaign(UUID campaignId, String reason, GroupBuyCloseCode code) {
        GroupBuyCampaign campaign = lockCampaign(campaignId);
        if (campaign.getStatus().isTerminal()) {
            throw new ApiException("This campaign has already ended", HttpStatus.BAD_REQUEST);
        }
        cancelLocked(campaign, reason, code);
    }

    @Override
    @Transactional
    public void cancelGroup(UUID groupId, String reason) {
        UUID campaignId = groupRepository.findCampaignIdByGroupId(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyGroup", "id", groupId));
        GroupBuyCampaign campaign = lockCampaign(campaignId);
        GroupBuyGroup group = lockGroup(groupId);
        if (group.getStatus() != GroupBuyGroupStatus.OPEN) {
            throw new ApiException("Only open groups can be cancelled", HttpStatus.BAD_REQUEST);
        }
        String note = reason != null && !reason.isBlank() ? reason.trim() : "Cancelled by an administrator";
        closeGroupWithRefunds(campaign, group, GroupBuyGroupStatus.CANCELLED,
                "Group cancelled by GroupMart: " + note, GroupBuyCloseCode.GROUP_REMOVED_BY_ADMIN);
    }

    @Override
    @Transactional
    public void removeMember(UUID groupId, UUID userId, boolean removedByAdmin, String reason) {
        UUID campaignId = groupRepository.findCampaignIdByGroupId(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyGroup", "id", groupId));
        GroupBuyCampaign campaign = lockCampaign(campaignId);
        GroupBuyGroup group = lockGroup(groupId);

        GroupBuyParticipant participant = participantRepository.findByBuyGroupIdAndUserId(groupId, userId)
                .filter(p -> p.getStatus() == GroupBuyParticipantStatus.JOINED)
                .orElseThrow(() -> new ApiException(removedByAdmin
                        ? "That shopper is not an active member of this group"
                        : "You're not an active member of this group", HttpStatus.BAD_REQUEST));
        if (group.getStatus() != GroupBuyGroupStatus.OPEN) {
            throw new ApiException("This group has already closed", HttpStatus.BAD_REQUEST);
        }

        User member = participant.getUser();
        LocalDateTime now = LocalDateTime.now();
        int quantity = participant.getQuantity();
        participant.setStatus(GroupBuyParticipantStatus.LEFT);
        participant.setPaymentStatus(PaymentStatus.REFUNDED);
        participant.setRefundAmount(participant.getAmountPaid());
        participant.setLeftAt(now);

        group.setParticipantCount(Math.max(0, group.getParticipantCount() - 1));
        group.setTotalQuantity(Math.max(0, group.getTotalQuantity() - quantity));
        if (campaign.getMinParticipants() - group.getParticipantCount() > 1) {
            group.setAlmostThereNotified(false);
        }
        campaign.setCommittedQuantity(Math.max(0, campaign.getCommittedQuantity() - quantity));

        String link = groupLink(groupId);
        String productName = shortText(campaign.getProduct().getName(), 60);
        String refundText = "Your payment of " + money(participant.getAmountPaid()) + " for '" + productName
                + "' has been refunded.";
        if (removedByAdmin) {
            String note = reason != null && !reason.isBlank() ? reason.trim() : "a policy review";
            events.activity(group, null, "MEMBER_REMOVED", displayName(member) + " was removed by GroupMart");
            events.notify(member, "You were removed from a group buy",
                    "GroupMart removed you from a group after " + note + ". " + refundText,
                    "GROUP_BUY_REFUND", link);
        } else {
            events.activity(group, member, "MEMBER_LEFT", displayName(member) + " left the group");
            events.notify(member, "You left a group buy", refundText, "GROUP_BUY_REFUND", link);
        }

        String departed = removedByAdmin ? " was removed from" : " left";
        List<GroupBuyParticipant> remaining = participantRepository
                .findByBuyGroupIdAndStatusOrderByJoinedAtAsc(groupId, GroupBuyParticipantStatus.JOINED);
        if (remaining.isEmpty()) {
            group.setStatus(GroupBuyGroupStatus.CANCELLED);
            group.setCompletedAt(now);
            group.setFailureReason("All participants left the group");
            group.setCloseCode(GroupBuyCloseCode.ALL_MEMBERS_LEFT);
            events.activity(group, null, "GROUP_CANCELLED", "Group closed because all participants left");
        } else if (group.getLeader().getId().equals(member.getId())) {
            User newLeader = remaining.get(0).getUser();
            group.setLeader(newLeader);
            events.activity(group, newLeader, "LEADER_CHANGED", displayName(newLeader) + " is now the group leader");
            events.notify(newLeader, "You're now the group leader",
                    "The previous leader" + departed + " your group for '" + productName
                            + "'. Keep sharing invite code " + group.getInviteCode() + "!",
                    "GROUP_BUY_LEAVE", link);
        } else {
            events.notify(group.getLeader(),
                    removedByAdmin ? "A member was removed from your group" : "A member left your group",
                    displayName(member) + departed + " your group for '" + productName + "'. "
                            + group.getParticipantCount() + " of " + campaign.getMinParticipants() + " needed.",
                    "GROUP_BUY_LEAVE", link);
        }
    }

    @Override
    @Transactional
    public void sendExpiryReminder(UUID groupId) {
        UUID campaignId = groupRepository.findCampaignIdByGroupId(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyGroup", "id", groupId));
        GroupBuyCampaign campaign = lockCampaign(campaignId);
        GroupBuyGroup group = lockGroup(groupId);
        if (group.getStatus() != GroupBuyGroupStatus.OPEN || group.isExpiryReminderSent()) {
            return;
        }

        int needed = Math.max(0, campaign.getMinParticipants() - group.getParticipantCount());
        String productName = shortText(campaign.getProduct().getName(), 60);
        String message = needed > 0
                ? "Less than an hour left for your group on '" + productName + "' and " + needed
                  + " more participant(s) needed. Share invite code " + group.getInviteCode() + "!"
                : "Less than an hour left. Your group on '" + productName
                  + "' reached its goal and orders will be placed when the timer ends.";

        List<GroupBuyParticipant> members = participantRepository
                .findByBuyGroupIdAndStatusOrderByJoinedAtAsc(groupId, GroupBuyParticipantStatus.JOINED);
        events.notifyMembers(members, null, "Group buy ending soon", message, "GROUP_BUY_EXPIRING", groupLink(groupId));
        events.activity(group, null, "EXPIRING_SOON", needed > 0
                ? "Less than an hour left: " + needed + " more participant(s) needed"
                : "Less than an hour left: goal already reached");
        group.setExpiryReminderSent(true);
    }

    @Override
    @Transactional
    public void sendFollowerEndingReminder(UUID campaignId) {
        GroupBuyCampaign campaign = lockCampaign(campaignId);
        if (campaign.getStatus() != GroupBuyCampaignStatus.ACTIVE || campaign.getFollowersEndingAlertAt() != null) {
            return;
        }
        dealAlerts.endingSoon(campaign);
    }

    // ----------------------------------------------------------------------------------------

    private void settleLocked(GroupBuyCampaign campaign, GroupBuyGroup group, boolean force, String note) {
        if (group.getStatus() != GroupBuyGroupStatus.OPEN) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        boolean expired = !group.getExpiresAt().isAfter(now);
        boolean full = group.getParticipantCount() >= campaign.getMaxParticipants();
        if (!force && !expired && !full) {
            return;
        }

        if (group.getParticipantCount() >= campaign.getMinParticipants()) {
            completeGroup(campaign, group, now);
        } else {
            String reason = "Only " + group.getParticipantCount() + " of " + campaign.getMinParticipants()
                    + " required participants joined " + (note != null ? "(" + note + ")" : "before the deadline");
            closeGroupWithRefunds(campaign, group, GroupBuyGroupStatus.FAILED, reason, note != null
                    ? GroupBuyCloseCode.CLOSED_EARLY_BELOW_MINIMUM
                    : GroupBuyCloseCode.NOT_ENOUGH_PARTICIPANTS);
        }
    }

    private void completeGroup(GroupBuyCampaign campaign, GroupBuyGroup group, LocalDateTime now) {
        BigDecimal finalPrice = GroupBuyPricing.unitPriceFor(campaign, group.getParticipantCount());
        group.setStatus(GroupBuyGroupStatus.SUCCESS);
        group.setFinalUnitPrice(finalPrice);
        group.setCompletedAt(now);

        String link = groupLink(group.getId());
        String productName = shortText(campaign.getProduct().getName(), 60);
        List<GroupBuyParticipant> members = participantRepository
                .findByBuyGroupIdAndStatusOrderByJoinedAtAsc(group.getId(), GroupBuyParticipantStatus.JOINED);

        for (GroupBuyParticipant member : members) {
            // Price protection: never charge more than the unit price shown at join time
            BigDecimal memberUnitPrice = finalPrice.min(member.getUnitPriceAtJoin());
            BigDecimal total = GroupBuyPricing.lineTotal(memberUnitPrice, member.getQuantity());
            BigDecimal refund = member.getAmountPaid().subtract(total).max(BigDecimal.ZERO);

            Order order = createOrder(campaign, group, member, memberUnitPrice, total);
            recordPayments(order, member, total, refund);

            member.setOrder(order);
            member.setFinalUnitPrice(memberUnitPrice);
            member.setRefundAmount(refund);
            member.setStatus(GroupBuyParticipantStatus.CONVERTED);
            campaign.setSoldQuantity(campaign.getSoldQuantity() + member.getQuantity());

            String refundText = refund.signum() > 0
                    ? " The price dropped after you joined, so " + money(refund) + " was refunded."
                    : "";
            events.notify(member.getUser(), "Group buy successful!",
                    "Your group for '" + productName + "' succeeded. Order " + order.getOrderNumber()
                            + " was created at " + money(memberUnitPrice) + " each." + refundText,
                    "GROUP_BUY_SUCCESS", link);
        }

        events.activity(group, null, "GROUP_SUCCEEDED", "Group succeeded with " + group.getParticipantCount()
                + " participants at " + money(finalPrice) + " each. Orders have been created.");
        events.notify(campaign.getSellerStore().getUser(), "Group buy orders created",
                members.size() + " order(s) were created for '" + productName + "' from a successful group.",
                "GROUP_BUY_CAMPAIGN", SELLER_LINK);
    }

    private void closeGroupWithRefunds(GroupBuyCampaign campaign, GroupBuyGroup group,
                                       GroupBuyGroupStatus status, String reason, GroupBuyCloseCode code) {
        group.setStatus(status);
        group.setFailureReason(shortText(reason, 500));
        group.setCloseCode(code);
        group.setCompletedAt(LocalDateTime.now());

        String productName = shortText(campaign.getProduct().getName(), 60);
        String title = status == GroupBuyGroupStatus.FAILED ? "Group buy did not reach its goal" : "Group buy cancelled";
        List<GroupBuyParticipant> members = participantRepository
                .findByBuyGroupIdAndStatusOrderByJoinedAtAsc(group.getId(), GroupBuyParticipantStatus.JOINED);

        for (GroupBuyParticipant member : members) {
            member.setStatus(GroupBuyParticipantStatus.REFUNDED);
            member.setPaymentStatus(PaymentStatus.REFUNDED);
            member.setRefundAmount(member.getAmountPaid());
            campaign.setCommittedQuantity(Math.max(0, campaign.getCommittedQuantity() - member.getQuantity()));
            events.notify(member.getUser(), title,
                    "Your group for '" + productName + "' closed: " + reason + ". Your payment of "
                            + money(member.getAmountPaid()) + " has been fully refunded.",
                    status == GroupBuyGroupStatus.FAILED ? "GROUP_BUY_FAILED" : "GROUP_BUY_REFUND",
                    groupLink(group.getId()));
        }

        events.activity(group, null,
                status == GroupBuyGroupStatus.FAILED ? "GROUP_FAILED" : "GROUP_CANCELLED",
                reason + ". All payments were refunded.");
    }

    private void cancelLocked(GroupBuyCampaign campaign, String reason, GroupBuyCloseCode code) {
        String note = reason != null && !reason.isBlank() ? reason.trim() : "Campaign cancelled";
        for (UUID groupId : groupRepository.findOpenGroupIdsByCampaign(campaign.getId())) {
            closeGroupWithRefunds(campaign, lockGroup(groupId), GroupBuyGroupStatus.CANCELLED,
                    "Campaign cancelled: " + note, code);
        }
        campaign.setStatus(GroupBuyCampaignStatus.CANCELLED);
        campaign.setCloseCode(code);
        campaign.setClosingNote(shortText(note, 500));
        campaign.setClosedAt(LocalDateTime.now());
        releaseInventory(campaign);
        dealAlerts.dealEnded(campaign);

        events.notify(campaign.getSellerStore().getUser(), "Group buy campaign cancelled",
                "'" + shortText(campaign.getTitle(), 80) + "' was cancelled: " + note,
                "GROUP_BUY_CAMPAIGN", SELLER_LINK);
    }

    private Order createOrder(GroupBuyCampaign campaign, GroupBuyGroup group, GroupBuyParticipant member,
                              BigDecimal unitPrice, BigDecimal total) {
        Product product = campaign.getProduct();
        BigDecimal baseTotal = GroupBuyPricing.lineTotal(campaign.getBasePrice(), member.getQuantity());

        // Group buy prices include tax and shipping; the saving is shown as the order discount
        Order order = Order.builder()
                .orderNumber(generateOrderNumber())
                .user(member.getUser())
                .status(OrderStatus.PENDING)
                .paymentStatus(PaymentStatus.COMPLETED)
                .paymentMethod(member.getPaymentMethod())
                .subtotalAmount(baseTotal)
                .taxAmount(BigDecimal.ZERO)
                .shippingAmount(BigDecimal.ZERO)
                .discountAmount(baseTotal.subtract(total).max(BigDecimal.ZERO))
                .totalAmount(total)
                .shippingAddressLine1(member.getShippingAddressLine1())
                .shippingAddressLine2(member.getShippingAddressLine2())
                .shippingCity(member.getShippingCity())
                .shippingState(member.getShippingState())
                .shippingPostalCode(member.getShippingPostalCode())
                .shippingCountry(member.getShippingCountry())
                .orderType(OrderType.GROUP_BUY)
                .groupBuyGroupId(group.getId())
                .items(new ArrayList<>())
                .build();
        deliveryEstimateService.applyOnPlacement(order);
        Order saved = orderRepository.save(order);

        OrderItem item = OrderItem.builder()
                .order(saved)
                .product(product)
                .sellerStore(campaign.getSellerStore())
                .productName(product.getName())
                .productSku(product.getSku())
                .quantity(member.getQuantity())
                .unitPrice(unitPrice)
                .subtotal(total)
                .build();
        saved.getItems().add(item);
        orderItemRepository.save(item);
        return saved;
    }

    private void recordPayments(Order order, GroupBuyParticipant member, BigDecimal captured, BigDecimal refund) {
        String reference = member.getPaymentReference() != null
                ? member.getPaymentReference()
                : "txn_gb_" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);

        paymentTransactionRepository.save(PaymentTransaction.builder()
                .order(order)
                .transactionId(reference)
                .paymentMethod(member.getPaymentMethod())
                .status(PaymentStatus.COMPLETED)
                .amount(captured)
                .gatewayResponse("SANDBOX_GROUP_BUY_CAPTURE: paid " + money(member.getAmountPaid())
                        + " at join, captured " + money(captured))
                .build());

        if (refund.signum() > 0) {
            paymentTransactionRepository.save(PaymentTransaction.builder()
                    .order(order)
                    .transactionId(reference + "_rf")
                    .paymentMethod(member.getPaymentMethod())
                    .status(PaymentStatus.REFUNDED)
                    .amount(refund)
                    .gatewayResponse("SANDBOX_GROUP_BUY_PRICE_DROP_REFUND")
                    .build());
        }
    }

    private void releaseInventory(GroupBuyCampaign campaign) {
        if (!campaign.isInventoryReserved() || campaign.isInventoryReleased()) {
            return;
        }
        int leftover = campaign.getReservedQuantity() - campaign.getSoldQuantity();
        if (leftover > 0) {
            UUID productId = campaign.getProduct().getId();
            Integer before = productRepository.findStockQuantityById(productId);
            productRepository.incrementStock(productId, leftover);
            logInventory(campaign, before, leftover, "GROUP_BUY_RELEASE");
        }
        campaign.setInventoryReleased(true);
        campaign.setCommittedQuantity(campaign.getSoldQuantity());
    }

    private void logInventory(GroupBuyCampaign campaign, Integer before, int change, String reason) {
        int previous = before != null ? before : 0;
        inventoryLogRepository.save(InventoryLog.builder()
                .product(campaign.getProduct())
                .sellerStore(campaign.getSellerStore())
                .previousQuantity(previous)
                .newQuantity(previous + change)
                .quantityChange(change)
                .reason(reason)
                .referenceId("GROUP_BUY:" + campaign.getId())
                .build());
    }

    private String generateOrderNumber() {
        String datePrefix = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        String orderNumber;
        do {
            orderNumber = "ORD-" + datePrefix + "-GB" + String.format("%05d", RANDOM.nextInt(100_000));
        } while (orderRepository.existsByOrderNumber(orderNumber));
        return orderNumber;
    }

    private GroupBuyCampaign lockCampaign(UUID campaignId) {
        return campaignRepository.findByIdForUpdate(campaignId)
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyCampaign", "id", campaignId));
    }

    private GroupBuyGroup lockGroup(UUID groupId) {
        return groupRepository.findByIdForUpdate(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyGroup", "id", groupId));
    }
}
