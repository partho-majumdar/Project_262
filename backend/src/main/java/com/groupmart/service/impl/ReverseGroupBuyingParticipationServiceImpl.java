package com.groupmart.service.impl;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.notification.SendNotificationRequest;
import com.groupmart.dto.reverse.ReverseGroupBuyingParticipationDto;
import com.groupmart.dto.reverse.ReverseGroupBuyingParticipationRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.NotificationService;
import com.groupmart.service.ReverseGroupBuyingCampaignService;
import com.groupmart.service.ReverseGroupBuyingParticipationService;

/**
 * Customers contributing demand to a Reverse Group Buying offer, independently of one another.
 * <p>
 * This service never touches CWP tables or wholesale prices: it locks a ReverseGroupBuyingOffer row,
 * reserves stock through {@link ReservedStockManager}, records an independent participation and
 * lets {@link ReverseGroupBuyingCampaignService} decide whether the seller's target condition has
 * now been met.
 */
@Service
@RequiredArgsConstructor
public class ReverseGroupBuyingParticipationServiceImpl implements ReverseGroupBuyingParticipationService {

    private static final Set<PaymentMethod> ONLINE_PAYMENT_METHODS = EnumSet.of(
            PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD, PaymentMethod.PAYPAL, PaymentMethod.STRIPE);

    private final ReverseGroupBuyingOfferRepository offerRepository;
    private final ReverseGroupBuyingParticipationRepository participationRepository;
    private final UserRepository userRepository;
    private final AddressRepository addressRepository;
    private final ReservedStockManager stockManager;
    private final ReverseGroupBuyingCampaignService campaignService;
    private final NotificationService notificationService;
    private final ReverseGroupBuyingMapper mapper;

    @Override
    @Transactional
    public ReverseGroupBuyingParticipationDto participate(String userEmail, UUID offerId,
                                                          ReverseGroupBuyingParticipationRequest request) {
        User user = requireUser(userEmail);
        // Row-locked so concurrent participations against this offer serialize on the collective demand.
        ReverseGroupBuyingOffer offer = offerRepository.findByIdForUpdate(offerId)
                .orElseThrow(() -> new ResourceNotFoundException("ReverseGroupBuyingOffer", "id", offerId));

        LocalDateTime now = LocalDateTime.now();
        if (!offer.getStatus().acceptsDemand()) {
            throw bad("This reverse group buying offer is not collecting demand right now");
        }
        if (!offer.getParticipationDeadline().isAfter(now)) {
            // Server-side deadline: the frontend clock is never trusted.
            throw bad("The participation deadline for this offer has passed");
        }

        int quantity = request.getQuantity();
        if (quantity < offer.getMinQuantityPerCustomer()) {
            throw bad("Minimum quantity per customer is " + offer.getMinQuantityPerCustomer());
        }
        if (quantity > offer.getMaxQuantityPerCustomer()) {
            throw bad("Maximum quantity per customer is " + offer.getMaxQuantityPerCustomer());
        }

        int alreadyClaimed = participationRepository.sumActiveQuantityByOfferAndUser(offerId, user.getId());
        if (alreadyClaimed + quantity > offer.getMaxQuantityPerCustomer()) {
            throw bad("You have already committed " + alreadyClaimed + " unit(s) to this offer; the limit is "
                    + offer.getMaxQuantityPerCustomer() + " unit(s) per customer");
        }
        if (quantity > offer.getRemainingDemand()) {
            throw bad("Only " + offer.getRemainingDemand() + " more unit(s) can be added to this offer");
        }

        Address address = addressRepository.findByIdAndUserId(request.getAddressId(), user.getId())
                .orElseThrow(() -> bad("Select a valid shipping address"));
        validatePaymentMethod(request.getPaymentMethod());

        // Take the units out of sellable stock before accepting the demand, so the collective can
        // never promise more than the seller physically has.
        stockManager.reserve(offer.getProduct(), offer.getSellerStore(), quantity,
                "REVERSE_GB_RESERVE", "REVERSE_GB_OFFER:" + offer.getId());

        BigDecimal unitPrice = offer.getUnlockedUnitPrice();
        ShippingSnapshot shipping = ShippingSnapshot.of(address);
        ReverseGroupBuyingParticipation participation =
                participationRepository.save(ReverseGroupBuyingParticipation.builder()
                        .offer(offer)
                        .user(user)
                        .quantity(quantity)
                        .unitPrice(unitPrice)
                        .totalAmount(unitPrice.multiply(BigDecimal.valueOf(quantity)))
                        .status(ReverseGroupBuyingParticipationStatus.PARTICIPATING)
                        .paymentStatus(PaymentStatus.COMPLETED) // sandbox capture, as with the other collective modes
                        .paymentMethod(request.getPaymentMethod())
                        .paymentReference(CollectiveOrderFactory.paymentReference("rgb"))
                        .shippingAddressLine1(shipping.line1())
                        .shippingAddressLine2(shipping.line2())
                        .shippingCity(shipping.city())
                        .shippingState(shipping.state())
                        .shippingPostalCode(shipping.postalCode())
                        .shippingCountry(shipping.country())
                        .participatedAt(now)
                        .build());

        offer.setCurrentDemand(offer.getCurrentDemand() + quantity);
        offer.setParticipantCount(offer.getParticipantCount() + 1);
        offerRepository.save(offer);

        // May unlock the purchasing condition and create this customer's order in the same transaction.
        campaignService.syncProgress(offer);

        return mapper.toParticipationDto(participationRepository.findById(participation.getId()).orElseThrow());
    }

    @Override
    @Transactional
    public ReverseGroupBuyingParticipationDto cancelParticipation(String userEmail, UUID participationId, String reason) {
        User user = requireUser(userEmail);
        ReverseGroupBuyingParticipation participation = participationRepository.findByIdAndUserId(participationId, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("ReverseGroupBuyingParticipation", "id", participationId));

        if (participation.getStatus() != ReverseGroupBuyingParticipationStatus.PARTICIPATING) {
            throw bad("This participation can no longer be withdrawn. Once the purchasing condition is unlocked, "
                    + "cancel the generated order instead.");
        }

        ReverseGroupBuyingOffer offer = participation.getOffer();
        // Same lock order participate() uses, so a cancel can never interleave with an activation.
        offerRepository.findByIdForUpdate(offer.getId())
                .orElseThrow(() -> new ResourceNotFoundException("ReverseGroupBuyingOffer", "id", offer.getId()));
        if (!offer.getStatus().acceptsDemand()) {
            throw bad("This offer has already been finalized; cancel the generated order instead");
        }

        participation.setStatus(ReverseGroupBuyingParticipationStatus.CANCELLED);
        participation.setPaymentStatus(PaymentStatus.REFUNDED);
        participation.setRefundAmount(participation.getTotalAmount());
        participation.setCancelledAt(LocalDateTime.now());
        participation.setCancellationReason(shortText(reasonOrDefault(reason, "Withdrawn by the customer"), 500));
        participationRepository.save(participation);

        stockManager.release(offer.getProduct(), offer.getSellerStore(), participation.getQuantity(),
                "REVERSE_GB_WITHDRAW", "REVERSE_GB_PART:" + participation.getId());

        // Recalculate the collective demand; this can also drop the offer back out of almost-complete.
        offer.setCurrentDemand(Math.max(0, offer.getCurrentDemand() - participation.getQuantity()));
        offer.setParticipantCount(Math.max(0, offer.getParticipantCount() - 1));
        offerRepository.save(offer);
        campaignService.syncProgress(offer);

        notificationService.sendNotification(SendNotificationRequest.builder()
                .userId(user.getId())
                .title("Reverse group buying participation withdrawn")
                .message(shortText("Your " + participation.getQuantity() + " unit(s) were released back to '"
                        + shortText(offer.getProduct().getName(), 60) + "' and the full amount refunded.", 1000))
                .type("REVERSE_GROUP_BUYING")
                .link("/reverse-group-buying/my")
                .build());

        return mapper.toParticipationDto(participation);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReverseGroupBuyingParticipationDto> getMyParticipations(String userEmail) {
        User user = requireUser(userEmail);
        return participationRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(mapper::toParticipationDto)
                .toList();
    }

    // ----- Helpers -----------------------------------------------------------------------------

    private void validatePaymentMethod(PaymentMethod method) {
        if (method == null || !ONLINE_PAYMENT_METHODS.contains(method)) {
            throw bad("Reverse group buying requires an online payment method (card, PayPal or Stripe)");
        }
    }

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    private static String reasonOrDefault(String reason, String fallback) {
        return reason != null && !reason.isBlank() ? reason.trim() : fallback;
    }

    private static String shortText(String text, int max) {
        if (text == null) {
            return null;
        }
        return text.length() <= max ? text : text.substring(0, max - 1) + "…";
    }

    private static ApiException bad(String message) {
        return new ApiException(message, HttpStatus.BAD_REQUEST);
    }
}
