package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.groupbuy.GroupBuyDisputeDto;
import com.groupmart.dto.groupbuy.GroupBuyDisputeRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.GroupBuyDisputeRepository;
import com.groupmart.repository.GroupBuyParticipantRepository;
import com.groupmart.repository.UserRepository;
import com.groupmart.service.GroupBuyDisputeService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static com.groupmart.service.impl.GroupBuyEventRecorder.*;

@Service
@RequiredArgsConstructor
public class GroupBuyDisputeServiceImpl implements GroupBuyDisputeService {

    private static final Set<GroupBuyDisputeStatus> OPEN_STATUSES =
            EnumSet.of(GroupBuyDisputeStatus.OPEN, GroupBuyDisputeStatus.UNDER_REVIEW);

    private final GroupBuyDisputeRepository disputeRepository;
    private final GroupBuyParticipantRepository participantRepository;
    private final UserRepository userRepository;
    private final OrderPaymentDetailsAssembler paymentAssembler;
    private final GroupBuyAdminMapper adminMapper;
    private final GroupBuyEventRecorder events;
    private final GroupBuyAuditLogger audit;

    // ----- Customer ----------------------------------------------------------------------------

    @Override
    @Transactional
    public GroupBuyDisputeDto openDispute(String userEmail, UUID groupId, GroupBuyDisputeRequest request) {
        User user = requireUser(userEmail);
        GroupBuyParticipant participant = participantRepository.findByBuyGroupIdAndUserId(groupId, user.getId())
                .orElseThrow(() -> new ApiException("You can only report a problem with a group you joined",
                        HttpStatus.FORBIDDEN));
        if (disputeRepository.existsByParticipantIdAndStatusIn(participant.getId(), OPEN_STATUSES)) {
            throw new ApiException("You already have an open report for this group. We'll update you on it soon.",
                    HttpStatus.CONFLICT);
        }

        GroupBuyDispute dispute = disputeRepository.save(GroupBuyDispute.builder()
                .participant(participant)
                .raisedBy(user)
                .type(request.getType())
                .description(request.getDescription().trim())
                .build());

        GroupBuyCampaign campaign = participant.getBuyGroup().getCampaign();
        String title = shortText(campaign.getTitle(), 80);
        events.notify(user, "We received your report",
                "Your report about '" + title + "' (" + request.getType().getLabel().toLowerCase()
                        + ") was sent to GroupMart support. We'll notify you when it's reviewed.",
                "GROUP_BUY_DISPUTE", groupLink(groupId));
        events.notifyAdmins("New group buy dispute",
                adminFacingName(user) + " reported \"" + request.getType().getLabel() + "\" on '" + title + "'.",
                "disputes");
        audit.record(userEmail, "DISPUTE_OPEN", GroupBuyAuditLogger.DISPUTE,
                "Dispute [" + dispute.getId() + "] " + request.getType() + " on group " + groupId + " of "
                        + GroupBuyAuditLogger.describe(campaign));
        return adminMapper.toDisputeDto(dispute);
    }

    @Override
    @Transactional(readOnly = true)
    public List<GroupBuyDisputeDto> getMyDisputes(String userEmail) {
        User user = requireUser(userEmail);
        return disputeRepository.findByRaisedByIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(adminMapper::toDisputeDto)
                .toList();
    }

    // ----- Admin -------------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<GroupBuyDisputeDto> getDisputes(String status) {
        List<GroupBuyDispute> disputes;
        if (status == null || status.isBlank() || "ALL".equalsIgnoreCase(status)) {
            disputes = disputeRepository.findAllByOrderByCreatedAtDesc();
        } else if ("ACTIVE".equalsIgnoreCase(status)) {
            disputes = disputeRepository.findByStatusInOrderByCreatedAtDesc(OPEN_STATUSES);
        } else {
            disputes = disputeRepository.findByStatusInOrderByCreatedAtDesc(List.of(parseStatus(status)));
        }
        return disputes.stream().map(adminMapper::toDisputeDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public GroupBuyDisputeDto getDispute(UUID disputeId) {
        return adminMapper.toDisputeDto(requireDispute(disputeId));
    }

    @Override
    @Transactional
    public GroupBuyDisputeDto startReview(String adminEmail, UUID disputeId, String note) {
        User admin = requireUser(adminEmail);
        GroupBuyDispute dispute = requireDispute(disputeId);
        if (dispute.getStatus() != GroupBuyDisputeStatus.OPEN) {
            throw new ApiException("Only new disputes can be moved to review", HttpStatus.BAD_REQUEST);
        }
        dispute.setStatus(GroupBuyDisputeStatus.UNDER_REVIEW);
        dispute.setHandledBy(admin);
        if (note != null && !note.isBlank()) {
            dispute.setResolutionNote(shortText(note.trim(), 1000));
        }

        GroupBuyParticipant participant = dispute.getParticipant();
        events.notify(dispute.getRaisedBy(), "Your report is being reviewed",
                "GroupMart is reviewing your report about '"
                        + shortText(participant.getBuyGroup().getCampaign().getTitle(), 80) + "'.",
                "GROUP_BUY_DISPUTE", groupLink(participant.getBuyGroup().getId()));
        audit.record(adminEmail, "DISPUTE_REVIEW", GroupBuyAuditLogger.DISPUTE,
                "Dispute [" + disputeId + "] moved to review");
        return adminMapper.toDisputeDto(dispute);
    }

    @Override
    @Transactional
    public GroupBuyDisputeDto resolve(String adminEmail, UUID disputeId, BigDecimal refundAmount, String note) {
        User admin = requireUser(adminEmail);
        GroupBuyDispute dispute = requireOpenDispute(disputeId);
        GroupBuyParticipant participant = dispute.getParticipant();
        GroupBuyCampaign campaign = participant.getBuyGroup().getCampaign();
        BigDecimal refund = refundAmount == null ? BigDecimal.ZERO : refundAmount.setScale(2, RoundingMode.HALF_UP);
        if (refund.signum() < 0) {
            throw new ApiException("Refund amount cannot be negative", HttpStatus.BAD_REQUEST);
        }
        if (refund.signum() == 0 && (note == null || note.isBlank())) {
            throw new ApiException("Explain the resolution when no refund is issued", HttpStatus.BAD_REQUEST);
        }

        BigDecimal priorDisputeRefunds = GroupBuyAdminMapper.orZero(
                disputeRepository.sumRefundsByParticipant(participant.getId()));
        BigDecimal refundable = GroupBuyAdminMapper.maxRefundable(participant, priorDisputeRefunds);
        if (refund.compareTo(refundable) > 0) {
            throw new ApiException(refundable.signum() == 0
                    ? "Nothing can be refunded for this participation: " + nothingRefundableReason(participant)
                    : "The refund cannot exceed " + money(refundable) + ", the amount this shopper still has paid",
                    HttpStatus.BAD_REQUEST);
        }

        String title = shortText(campaign.getTitle(), 80);
        String groupLink = groupLink(participant.getBuyGroup().getId());
        if (refund.signum() > 0) {
            Order order = participant.getOrder();
            paymentAssembler.recordRefund(order, refund,
                    "SANDBOX_GROUP_BUY_DISPUTE_REFUND: dispute " + dispute.getId());
            if (refund.compareTo(refundable) == 0) {
                order.setPaymentStatus(PaymentStatus.REFUNDED);
            }
            events.notify(campaign.getSellerStore().getUser(), "Group buy dispute refund issued",
                    "GroupMart refunded " + money(refund) + " on order " + order.getOrderNumber() + " for '"
                            + title + "' after reviewing a customer dispute.",
                    "GROUP_BUY_CAMPAIGN", SELLER_LINK);
        }

        dispute.setStatus(GroupBuyDisputeStatus.RESOLVED);
        dispute.setRefundAmount(refund);
        dispute.setResolutionNote(note != null && !note.isBlank() ? shortText(note.trim(), 1000) : null);
        dispute.setHandledBy(admin);
        dispute.setResolvedAt(LocalDateTime.now());

        String outcome = refund.signum() > 0
                ? money(refund) + " has been refunded to your "
                  + OrderPaymentDetailsAssembler.methodLabel(participant.getPaymentMethod()) + "."
                : "No refund was needed.";
        events.notify(dispute.getRaisedBy(), "Your report was resolved",
                "Your report about '" + title + "' was resolved. " + outcome
                        + (dispute.getResolutionNote() != null ? " Note: " + dispute.getResolutionNote() : ""),
                refund.signum() > 0 ? "PAYMENT_UPDATE" : "GROUP_BUY_DISPUTE", groupLink);
        audit.record(adminEmail, "DISPUTE_RESOLVE", GroupBuyAuditLogger.DISPUTE,
                "Dispute [" + disputeId + "] resolved with refund " + money(refund)
                        + (dispute.getResolutionNote() != null ? ". Note: " + dispute.getResolutionNote() : ""));
        return adminMapper.toDisputeDto(dispute);
    }

    @Override
    @Transactional
    public GroupBuyDisputeDto reject(String adminEmail, UUID disputeId, String note) {
        if (note == null || note.isBlank()) {
            throw new ApiException("Tell the shopper why the dispute was rejected", HttpStatus.BAD_REQUEST);
        }
        User admin = requireUser(adminEmail);
        GroupBuyDispute dispute = requireOpenDispute(disputeId);
        dispute.setStatus(GroupBuyDisputeStatus.REJECTED);
        dispute.setResolutionNote(shortText(note.trim(), 1000));
        dispute.setHandledBy(admin);
        dispute.setResolvedAt(LocalDateTime.now());

        GroupBuyGroup group = dispute.getParticipant().getBuyGroup();
        events.notify(dispute.getRaisedBy(), "Update on your report",
                "We reviewed your report about '" + shortText(group.getCampaign().getTitle(), 80)
                        + "' and couldn't approve it: " + dispute.getResolutionNote(),
                "GROUP_BUY_DISPUTE", groupLink(group.getId()));
        audit.record(adminEmail, "DISPUTE_REJECT", GroupBuyAuditLogger.DISPUTE,
                "Dispute [" + disputeId + "] rejected. Note: " + dispute.getResolutionNote());
        return adminMapper.toDisputeDto(dispute);
    }

    // ----- Helpers -----------------------------------------------------------------------------

    private static String nothingRefundableReason(GroupBuyParticipant participant) {
        return switch (participant.getStatus()) {
            case JOINED -> "the group is still open, so the shopper can leave it for a full refund";
            case LEFT, REFUNDED -> "the payment was already refunded in full";
            case CONVERTED -> "the order has already been refunded in full";
        };
    }

    private GroupBuyDispute requireOpenDispute(UUID disputeId) {
        GroupBuyDispute dispute = requireDispute(disputeId);
        if (dispute.getStatus().isClosed()) {
            throw new ApiException("This dispute is already closed", HttpStatus.BAD_REQUEST);
        }
        return dispute;
    }

    private GroupBuyDispute requireDispute(UUID disputeId) {
        return disputeRepository.findById(disputeId)
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyDispute", "id", disputeId));
    }

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    private static GroupBuyDisputeStatus parseStatus(String status) {
        try {
            return GroupBuyDisputeStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ApiException("Unknown dispute status: " + status, HttpStatus.BAD_REQUEST);
        }
    }

    /** Admin-facing name: full name and email, since admins need to contact the shopper. */
    private static String adminFacingName(User user) {
        return GroupBuyAdminMapper.fullName(user) + " (" + user.getEmail() + ")";
    }
}
