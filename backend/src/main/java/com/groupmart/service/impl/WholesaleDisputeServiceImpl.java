package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.notification.SendNotificationRequest;
import com.groupmart.dto.wholesale.WholesaleDisputeDto;
import com.groupmart.dto.wholesale.WholesaleDisputeRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.WholesaleDisputeRepository;
import com.groupmart.repository.WholesaleReservationRepository;
import com.groupmart.repository.UserRepository;
import com.groupmart.service.NotificationService;
import com.groupmart.service.WholesaleDisputeService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static com.groupmart.service.impl.GroupBuyAdminMapper.fullName;
import static com.groupmart.service.impl.GroupBuyAdminMapper.orZero;
import static com.groupmart.service.impl.GroupBuyEventRecorder.money;

@Service
@RequiredArgsConstructor
public class WholesaleDisputeServiceImpl implements WholesaleDisputeService {

    private static final String SELLER_LINK = "/seller/dashboard?tab=wholesale";
    private static final String CUSTOMER_LINK = "/orders";
    private static final String ADMIN_LINK = "/admin/dashboard?tab=wholesale&view=disputes";

    private static final Set<WholesaleDisputeStatus> OPEN_STATUSES =
            EnumSet.of(WholesaleDisputeStatus.OPEN, WholesaleDisputeStatus.UNDER_REVIEW);

    private final WholesaleDisputeRepository disputeRepository;
    private final WholesaleReservationRepository reservationRepository;
    private final UserRepository userRepository;
    private final OrderPaymentDetailsAssembler paymentAssembler;
    private final NotificationService notificationService;
    private final WholesaleMapper mapper;

    // ----- Customer ----------------------------------------------------------------------------

    @Override
    @Transactional
    public WholesaleDisputeDto openDispute(String userEmail, UUID reservationId, WholesaleDisputeRequest request) {
        User user = requireUser(userEmail);
        WholesaleReservation reservation = reservationRepository.findByIdAndUserId(reservationId, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("WholesaleReservation", "id", reservationId));
        if (reservation.getStatus() != WholesaleReservationStatus.CONVERTED || reservation.getOrder() == null) {
            throw new ApiException("You can only report a problem once your reservation has an order",
                    HttpStatus.BAD_REQUEST);
        }
        if (disputeRepository.existsByReservationIdAndStatusIn(reservationId, OPEN_STATUSES)) {
            throw new ApiException("You already have an open report for this order. We'll update you on it soon.",
                    HttpStatus.CONFLICT);
        }

        WholesaleDispute dispute = disputeRepository.save(WholesaleDispute.builder()
                .reservation(reservation)
                .raisedBy(user)
                .type(request.getType())
                .description(request.getDescription().trim())
                .build());

        String productName = shortText(reservation.getPool().getOffer().getProduct().getName(), 80);
        notify(user, "We received your report",
                "Your report about '" + productName + "' (" + request.getType().getLabel().toLowerCase()
                        + ") was sent to GroupMart support. We'll notify you when it's reviewed.",
                CUSTOMER_LINK);
        notifyAdmins("New wholesale dispute",
                fullName(user) + " (" + user.getEmail() + ") reported \"" + request.getType().getLabel()
                        + "\" on order " + reservation.getOrder().getOrderNumber() + " for '" + productName + "'.");
        return mapper.toDisputeDto(dispute);
    }

    @Override
    @Transactional(readOnly = true)
    public List<WholesaleDisputeDto> getMyDisputes(String userEmail) {
        User user = requireUser(userEmail);
        return disputeRepository.findByRaisedByIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(mapper::toDisputeDto)
                .toList();
    }

    // ----- Admin -------------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<WholesaleDisputeDto> getDisputes(String status) {
        List<WholesaleDispute> disputes;
        if (status == null || status.isBlank() || "ALL".equalsIgnoreCase(status)) {
            disputes = disputeRepository.findAllByOrderByCreatedAtDesc();
        } else if ("ACTIVE".equalsIgnoreCase(status)) {
            disputes = disputeRepository.findByStatusInOrderByCreatedAtDesc(OPEN_STATUSES);
        } else {
            disputes = disputeRepository.findByStatusInOrderByCreatedAtDesc(List.of(parseStatus(status)));
        }
        return disputes.stream().map(mapper::toDisputeDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public WholesaleDisputeDto getDispute(UUID disputeId) {
        return mapper.toDisputeDto(requireDispute(disputeId));
    }

    @Override
    @Transactional
    public WholesaleDisputeDto startReview(String adminEmail, UUID disputeId, String note) {
        User admin = requireUser(adminEmail);
        WholesaleDispute dispute = requireDispute(disputeId);
        if (dispute.getStatus() != WholesaleDisputeStatus.OPEN) {
            throw new ApiException("Only new disputes can be moved to review", HttpStatus.BAD_REQUEST);
        }
        dispute.setStatus(WholesaleDisputeStatus.UNDER_REVIEW);
        dispute.setHandledBy(admin);
        if (note != null && !note.isBlank()) {
            dispute.setResolutionNote(shortText(note.trim(), 1000));
        }

        String productName = shortText(dispute.getReservation().getPool().getOffer().getProduct().getName(), 80);
        notify(dispute.getRaisedBy(), "Your report is being reviewed",
                "GroupMart is reviewing your report about '" + productName + "'.", CUSTOMER_LINK);
        return mapper.toDisputeDto(dispute);
    }

    @Override
    @Transactional
    public WholesaleDisputeDto resolve(String adminEmail, UUID disputeId, BigDecimal refundAmount, String note) {
        User admin = requireUser(adminEmail);
        WholesaleDispute dispute = requireOpenDispute(disputeId);
        WholesaleReservation reservation = dispute.getReservation();
        WholesaleOffer offer = reservation.getPool().getOffer();
        BigDecimal refund = refundAmount == null ? BigDecimal.ZERO : refundAmount.setScale(2, RoundingMode.HALF_UP);
        if (refund.signum() < 0) {
            throw new ApiException("Refund amount cannot be negative", HttpStatus.BAD_REQUEST);
        }
        if (refund.signum() == 0 && (note == null || note.isBlank())) {
            throw new ApiException("Explain the resolution when no refund is issued", HttpStatus.BAD_REQUEST);
        }

        BigDecimal priorDisputeRefunds = orZero(disputeRepository.sumRefundsByReservation(reservation.getId()));
        BigDecimal refundable = WholesaleMapper.maxRefundable(reservation, priorDisputeRefunds);
        if (refund.compareTo(refundable) > 0) {
            throw new ApiException(refundable.signum() == 0
                    ? "Nothing can be refunded for this reservation: it was already refunded in full"
                    : "The refund cannot exceed " + money(refundable) + ", the amount this customer still has paid",
                    HttpStatus.BAD_REQUEST);
        }

        String productName = shortText(offer.getProduct().getName(), 80);
        if (refund.signum() > 0) {
            Order order = reservation.getOrder();
            paymentAssembler.recordRefund(order, refund, "SANDBOX_WHOLESALE_DISPUTE_REFUND: dispute " + dispute.getId());
            if (refund.compareTo(refundable) == 0) {
                order.setPaymentStatus(PaymentStatus.REFUNDED);
            }
            notify(offer.getSellerStore().getUser(), "Wholesale dispute refund issued",
                    "GroupMart refunded " + money(refund) + " on order " + order.getOrderNumber() + " for '"
                            + productName + "' after reviewing a customer dispute.", SELLER_LINK);
        }

        dispute.setStatus(WholesaleDisputeStatus.RESOLVED);
        dispute.setRefundAmount(refund);
        dispute.setResolutionNote(note != null && !note.isBlank() ? shortText(note.trim(), 1000) : null);
        dispute.setHandledBy(admin);
        dispute.setResolvedAt(LocalDateTime.now());

        String outcome = refund.signum() > 0
                ? money(refund) + " has been refunded to your original payment method."
                : "No refund was needed.";
        notify(dispute.getRaisedBy(), "Your report was resolved",
                "Your report about '" + productName + "' was resolved. " + outcome
                        + (dispute.getResolutionNote() != null ? " Note: " + dispute.getResolutionNote() : ""),
                CUSTOMER_LINK);
        return mapper.toDisputeDto(dispute);
    }

    @Override
    @Transactional
    public WholesaleDisputeDto reject(String adminEmail, UUID disputeId, String note) {
        if (note == null || note.isBlank()) {
            throw new ApiException("Tell the customer why the dispute was rejected", HttpStatus.BAD_REQUEST);
        }
        User admin = requireUser(adminEmail);
        WholesaleDispute dispute = requireOpenDispute(disputeId);
        dispute.setStatus(WholesaleDisputeStatus.REJECTED);
        dispute.setResolutionNote(shortText(note.trim(), 1000));
        dispute.setHandledBy(admin);
        dispute.setResolvedAt(LocalDateTime.now());

        String productName = shortText(dispute.getReservation().getPool().getOffer().getProduct().getName(), 80);
        notify(dispute.getRaisedBy(), "Update on your report",
                "We reviewed your report about '" + productName + "' and couldn't approve it: "
                        + dispute.getResolutionNote(), CUSTOMER_LINK);
        return mapper.toDisputeDto(dispute);
    }

    // ----- Helpers -----------------------------------------------------------------------------

    private WholesaleDispute requireOpenDispute(UUID disputeId) {
        WholesaleDispute dispute = requireDispute(disputeId);
        if (dispute.getStatus().isClosed()) {
            throw new ApiException("This dispute is already closed", HttpStatus.BAD_REQUEST);
        }
        return dispute;
    }

    private WholesaleDispute requireDispute(UUID disputeId) {
        return disputeRepository.findById(disputeId)
                .orElseThrow(() -> new ResourceNotFoundException("WholesaleDispute", "id", disputeId));
    }

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    private static WholesaleDisputeStatus parseStatus(String status) {
        try {
            return WholesaleDisputeStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ApiException("Unknown dispute status: " + status, HttpStatus.BAD_REQUEST);
        }
    }

    private void notify(User recipient, String title, String message, String link) {
        if (recipient == null) {
            return;
        }
        notificationService.sendNotification(SendNotificationRequest.builder()
                .userId(recipient.getId())
                .title(shortText(title, 150))
                .message(shortText(message, 1000))
                .type("WHOLESALE_DISPUTE")
                .link(link)
                .build());
    }

    private void notifyAdmins(String title, String message) {
        for (User admin : userRepository.findByRoleAndEnabledTrue(Role.ROLE_ADMIN)) {
            notify(admin, title, message, ADMIN_LINK);
        }
    }

    private static String shortText(String text, int max) {
        if (text == null) {
            return null;
        }
        return text.length() <= max ? text : text.substring(0, max - 1) + "…";
    }
}
