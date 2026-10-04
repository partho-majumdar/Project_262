package com.groupmart.service.impl;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.dto.notification.SendNotificationRequest;
import com.groupmart.dto.reverse.ReverseGroupBuyingCampaignDto;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.NotificationService;
import com.groupmart.service.ReverseGroupBuyingCampaignService;

import static com.groupmart.service.impl.GroupBuyEventRecorder.money;

/**
 * Unlocks a Reverse Group Buying offer's purchasing condition and turns each participation into its
 * own individual order.
 * <p>
 * Completely separate from {@link WholesalePurchaseServiceImpl} (CWP): it reads no WholesalePool,
 * writes no WholesaleReservation and never uses a wholesale minimum or wholesale price. Participants
 * are never merged into one customer order - each gets its own order, payment and delivery.
 */
@Service
@RequiredArgsConstructor
public class ReverseGroupBuyingCampaignServiceImpl implements ReverseGroupBuyingCampaignService {

    private static final String SELLER_LINK = "/seller/dashboard?tab=reverse-group-buying";
    private static final String CUSTOMER_LINK = "/orders";

    /** Notify the seller once demand has passed this fraction of the target condition. */
    private static final BigDecimal ALMOST_COMPLETE_FRACTION = new BigDecimal("0.8");

    private final ReverseGroupBuyingOfferRepository offerRepository;
    private final ReverseGroupBuyingParticipationRepository participationRepository;
    private final ReverseGroupBuyingCampaignRepository campaignRepository;
    private final OrderRepository orderRepository;
    private final ReservedStockManager stockManager;
    private final CollectiveOrderFactory orderFactory;
    private final NotificationService notificationService;
    private final ReverseGroupBuyingMapper mapper;

    @Override
    @Transactional(readOnly = true)
    public ReverseGroupBuyingCampaignDto getCampaignForOffer(UUID offerId) {
        return campaignRepository.findByOfferId(offerId).map(mapper::toCampaignDto).orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UUID> activeParticipationIds(ReverseGroupBuyingOffer offer) {
        return participationRepository
                .findByOfferIdAndStatus(offer.getId(), ReverseGroupBuyingParticipationStatus.PARTICIPATING).stream()
                .map(ReverseGroupBuyingParticipation::getId)
                .toList();
    }

    @Override
    @Transactional
    public boolean syncProgress(ReverseGroupBuyingOffer offer) {
        if (!offer.getStatus().acceptsDemand()) {
            return false; // already activated/closed: the collective result is frozen
        }
        if (offer.isTargetReached()) {
            activate(offer);
            return true;
        }
        BigDecimal threshold = BigDecimal.valueOf(offer.getTargetQuantity()).multiply(ALMOST_COMPLETE_FRACTION);
        if (BigDecimal.valueOf(offer.getCurrentDemand()).compareTo(threshold) >= 0) {
            if (!offer.isAlmostCompleteNotified()) {
                offer.setAlmostCompleteNotified(true);
                offer.setStatus(ReverseGroupBuyingOfferStatus.ALMOST_COMPLETE);
                notifySeller(offer, "Reverse Group Buying offer almost at target",
                        "Your reverse group buying offer for '" + shortText(offer.getProduct().getName(), 80)
                                + "' is close to its target of " + offer.getTargetQuantity() + " units: "
                                + offer.getCurrentDemand() + " units of collective demand so far.");
            }
        } else if (offer.getStatus() == ReverseGroupBuyingOfferStatus.ALMOST_COMPLETE) {
            // A withdrawal pulled the collective back below the threshold.
            offer.setStatus(ReverseGroupBuyingOfferStatus.OPEN);
        }
        return false;
    }

    @Override
    @Transactional
    public void closeAndRefund(ReverseGroupBuyingOffer offer, ReverseGroupBuyingCloseCode closeCode, String note) {
        LocalDateTime now = LocalDateTime.now();
        List<ReverseGroupBuyingParticipation> active = participationRepository
                .findByOfferIdAndStatus(offer.getId(), ReverseGroupBuyingParticipationStatus.PARTICIPATING);

        String productName = shortText(offer.getProduct().getName(), 60);
        for (ReverseGroupBuyingParticipation participation : active) {
            participation.setStatus(ReverseGroupBuyingParticipationStatus.REFUNDED);
            participation.setPaymentStatus(PaymentStatus.REFUNDED);
            participation.setRefundAmount(participation.getTotalAmount());
            participation.setCancelledAt(now);
            participation.setCancellationReason(closeCode.getLabel());
            participationRepository.save(participation);

            // The units were reserved when the customer participated and never sold, so give them back.
            stockManager.release(offer.getProduct(), offer.getSellerStore(), participation.getQuantity(),
                    "REVERSE_GB_RELEASE", "REVERSE_GB_PART:" + participation.getId());

            notify(participation.getUser(), "Reverse group buying offer did not unlock",
                    "The offer for '" + productName + "' closed before its target condition was met ("
                            + offer.getCurrentDemand() + "/" + offer.getTargetQuantity() + " units). "
                            + money(participation.getTotalAmount()) + " was refunded and your quantity released.",
                    CUSTOMER_LINK);
        }

        offer.setCurrentDemand(0);
        offer.setParticipantCount(0);
        offer.setStatus(statusFor(closeCode));
        offer.setCloseCode(closeCode);
        offer.setCloseNote(shortText(note, 500));
        offer.setClosedAt(now);
        offerRepository.save(offer);

        notifySeller(offer, "Reverse group buying offer closed",
                "The offer for '" + productName + "' closed with " + offer.getCurrentDemand() + " of "
                        + offer.getTargetQuantity() + " target units. " + active.size()
                        + " participation(s) were refunded and their inventory released.");
    }

    /**
     * TARGET_REACHED -> ACTIVATED -> PROCESSING, all inside the caller's transaction, so the offer and
     * the individual orders generated from it can never diverge.
     */
    private void activate(ReverseGroupBuyingOffer offer) {
        LocalDateTime now = LocalDateTime.now();
        offer.setStatus(ReverseGroupBuyingOfferStatus.TARGET_REACHED);
        offer.setTargetReachedAt(now);
        offer.setStatus(ReverseGroupBuyingOfferStatus.ACTIVATED);
        offer.setActivatedAt(now);
        offerRepository.saveAndFlush(offer);

        List<ReverseGroupBuyingParticipation> active = participationRepository
                .findByOfferIdAndStatus(offer.getId(), ReverseGroupBuyingParticipationStatus.PARTICIPATING);

        ReverseGroupBuyingCampaign campaign = campaignRepository.save(ReverseGroupBuyingCampaign.builder()
                .offer(offer)
                .targetType(offer.getTargetType())
                .unlockedUnitPrice(offer.getUnlockedUnitPrice())
                .basePriceAtActivation(offer.getBasePrice())
                .targetQuantity(offer.getTargetQuantity())
                .totalConfirmedQuantity(offer.getCurrentDemand())
                .participantCount(active.size())
                .activatedAt(now)
                .build());

        Product product = offer.getProduct();
        String productName = shortText(product.getName(), 60);
        for (ReverseGroupBuyingParticipation participation : active) {
            Order order = orderFactory.createIndividualOrder(
                    "RGB", OrderType.REVERSE_GROUP_BUYING, product, offer.getSellerStore(), participation.getUser(),
                    participation.getQuantity(), participation.getUnitPrice(),
                    new ShippingSnapshot(participation.getShippingAddressLine1(),
                            participation.getShippingAddressLine2(), participation.getShippingCity(),
                            participation.getShippingState(), participation.getShippingPostalCode(),
                            participation.getShippingCountry()),
                    participation.getPaymentMethod(), participation.getPaymentReference(),
                    "SANDBOX_REVERSE_GB_CAPTURE: captured at activation " + now);

            order.setReverseGroupBuyingCampaignId(campaign.getId());
            orderRepository.save(order);
            participation.setOrder(order);
            participation.setStatus(ReverseGroupBuyingParticipationStatus.CONVERTED);
            participationRepository.save(participation);

            notify(participation.getUser(), "Reverse group buying condition unlocked",
                    "The offer for '" + productName + "' reached its target of " + offer.getTargetQuantity()
                            + " units. Order " + order.getOrderNumber() + " was created for your "
                            + participation.getQuantity() + " unit(s) at " + money(participation.getUnitPrice())
                            + " each.", CUSTOMER_LINK);
        }

        offer.setStatus(ReverseGroupBuyingOfferStatus.PROCESSING);
        offerRepository.save(offer);

        notifySeller(offer, "Reverse group buying condition unlocked",
                "The offer for '" + productName + "' reached its target of " + offer.getTargetQuantity()
                        + " units. " + active.size() + " individual order(s) totalling "
                        + campaign.getTotalConfirmedQuantity() + " unit(s) were created. Begin fulfillment from "
                        + "your reverse group buying dashboard.");
    }

    /** Each close reason lands in its own end state, so reports never have to infer it. */
    private static ReverseGroupBuyingOfferStatus statusFor(ReverseGroupBuyingCloseCode closeCode) {
        return switch (closeCode) {
            case CLOSED_EARLY_BY_SELLER -> ReverseGroupBuyingOfferStatus.CLOSED;
            case CANCELLED_BY_SELLER -> ReverseGroupBuyingOfferStatus.CANCELLED;
            default -> ReverseGroupBuyingOfferStatus.FAILED;
        };
    }

    private void notifySeller(ReverseGroupBuyingOffer offer, String title, String message) {
        notify(offer.getSellerStore().getUser(), title, message, SELLER_LINK);
    }

    private void notify(User recipient, String title, String message, String link) {
        if (recipient == null) {
            return;
        }
        notificationService.sendNotification(SendNotificationRequest.builder()
                .userId(recipient.getId())
                .title(shortText(title, 150))
                .message(shortText(message, 1000))
                .type("REVERSE_GROUP_BUYING")
                .link(link)
                .build());
    }

    private static String shortText(String text, int max) {
        if (text == null) {
            return null;
        }
        return text.length() <= max ? text : text.substring(0, max - 1) + "…";
    }
}
