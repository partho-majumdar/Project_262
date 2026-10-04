package com.groupmart.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.dto.notification.SendNotificationRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.realtime.RealtimePublisher;
import com.groupmart.realtime.RealtimeTopics;

/**
 * Retires group reverse demands whose deadlines have passed.
 * <p>
 * This lives in its own {@code @Service} rather than in the scheduler on purpose. The scheduler
 * calls it through the Spring proxy, so {@link Propagation#REQUIRES_NEW} actually applies and each
 * demand is closed in its own transaction. Self-invocation from a scheduler method would bypass the
 * proxy, leaving the demand's lazy associations unreadable and the whole sweep to abort on the
 * first lapsed row.
 * <p>
 * Deadlines are enforced on every write path as well, so a group nobody touches still reaches a
 * truthful terminal state instead of sitting at "open" forever with an impossible deadline.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GroupReverseClosingService {

    private static final String NOTIFICATION_TYPE = "GROUP_REVERSE";

    private final GroupReverseDemandRepository demandRepository;
    private final GroupReverseMemberRepository memberRepository;
    private final GroupReverseOfferRepository offerRepository;
    private final NotificationService notificationService;
    private final RealtimePublisher realtimePublisher;

    /** An OPEN demand whose join deadline passed without meeting the target. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void expireJoinWindow(UUID demandId, LocalDateTime now) {
        GroupReverseDemand demand = demandRepository.findByIdForUpdate(demandId).orElse(null);
        if (demand == null || demand.getStatus() != GroupReverseDemandStatus.OPEN) {
            return;
        }
        // Read through the associations while this transaction is still open.
        String productName = demand.getProduct().getName();
        User leader = demand.getLeader();

        String note = "The join deadline passed with only " + demand.getCommittedQuantity() + " of "
                + demand.getRequiredQuantity() + " unit(s) committed, so the group could not be formed.";
        demand.setStatus(GroupReverseDemandStatus.TARGET_NOT_REACHED);
        demand.setCloseCode(GroupReverseCloseCode.JOIN_DEADLINE_PASSED_TARGET_UNMET);
        demand.setCloseNote(note);
        demand.setClosedAt(now);
        demandRepository.save(demand);

        for (GroupReverseMember member : memberRepository.findByDemandIdOrderByJoinedAtAsc(demandId)) {
            if (member.getStatus().isActive()) {
                member.setStatus(GroupReverseMemberStatus.CANCELLED);
                member.setCancelledAt(now);
                member.setCancellationReason("The group did not reach its target in time");
                memberRepository.save(member);
                notify(member.getCustomer(), "Group demand expired",
                        "'" + shortText(productName, 60)
                                + "' closed without reaching its target quantity. Nothing was charged and "
                                + "no seller is committed.",
                        "/group-reverse-demands/" + demandId);
            }
        }
        notify(leader, "Your group demand expired", note, "/group-reverse-demands/" + demandId);

        announceClosed(demand, "This group closed without reaching its target quantity");
    }

    /** A demand whose offer deadline passed: no offer at all, or offers nobody chose. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void expireOfferWindow(UUID demandId, LocalDateTime now) {
        GroupReverseDemand demand = demandRepository.findByIdForUpdate(demandId).orElse(null);
        if (demand == null || !demand.getStatus().acceptsOffers()) {
            return;
        }
        String productName = demand.getProduct().getName();
        List<GroupReverseOffer> live = offerRepository.findByDemandIdAndStatus(demandId,
                GroupReverseOfferStatus.SUBMITTED);
        boolean noOffers = live.isEmpty();

        String note = noOffers
                ? "The offer deadline passed with no seller offer, so no supplier was secured."
                : "The offer deadline passed without the demand creator selecting a seller.";
        demand.setStatus(noOffers ? GroupReverseDemandStatus.NO_OFFER : GroupReverseDemandStatus.EXPIRED);
        demand.setCloseCode(noOffers
                ? GroupReverseCloseCode.OFFER_DEADLINE_PASSED_NO_OFFERS
                : GroupReverseCloseCode.OFFER_DEADLINE_PASSED_UNSELECTED);
        demand.setCloseNote(note);
        demand.setClosedAt(now);
        demandRepository.save(demand);

        for (GroupReverseOffer offer : live) {
            offer.setStatus(GroupReverseOfferStatus.EXPIRED);
            offer.setClosedAt(now);
            offer.setCloseNote("The group's offer deadline passed");
            offerRepository.save(offer);
            notify(offer.getSellerStore().getUser(), "Your group offer expired",
                    "The group demand you bid on closed before an offer was selected.",
                    "/seller/dashboard?tab=group-reverse");
        }
        notify(demand.getLeader(), "Your group demand closed without a seller",
                "'" + shortText(productName, 60) + "': " + note, "/group-reverse-demands/" + demandId);

        announceClosed(demand, "This group's offer window closed");
    }

    /**
     * Announces a demand the deadline sweep closed.
     * <p>
     * This runs with no HTTP request behind it, so the change interceptor never sees it - without
     * this, a group that lapsed at midnight would only show up on the next manual refresh. The
     * leader and every member are told individually, because each of them is looking at their own
     * participation, and the public copy keeps the marketplace honest.
     */
    private void announceClosed(GroupReverseDemand demand, String summary) {
        String demandId = demand.getId().toString();
        realtimePublisher.userChanged(RealtimeTopics.GROUP_REVERSE, "group-reverse-demand",
                demand.getId(), demand.getLeader().getEmail(), summary);
        for (GroupReverseMember member : memberRepository.findByDemandIdOrderByJoinedAtAsc(
                demand.getId())) {
            realtimePublisher.userChanged(RealtimeTopics.GROUP_REVERSE, "group-reverse-demand",
                    demand.getId(), member.getCustomer().getEmail(), summary);
        }
        realtimePublisher.storefrontChanged("group-reverse-demand", demand.getId(), summary);
        log.debug("Announced closed group reverse demand {}", demandId);
    }

    private void notify(User recipient, String title, String message, String link) {
        if (recipient == null) {
            return;
        }
        try {
            notificationService.sendNotification(SendNotificationRequest.builder()
                    .userId(recipient.getId())
                    .title(shortText(title, 150))
                    .message(shortText(message, 1000))
                    .type(NOTIFICATION_TYPE)
                    .link(link)
                    .build());
        } catch (ApiException ex) {
            log.warn("Could not notify user {} about a group demand expiry", recipient.getId(), ex);
        }
    }

    private static String shortText(String text, int max) {
        if (text == null) {
            return null;
        }
        return text.length() <= max ? text : text.substring(0, max - 1) + "...";
    }
}
