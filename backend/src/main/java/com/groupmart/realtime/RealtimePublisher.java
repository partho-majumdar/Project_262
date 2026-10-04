package com.groupmart.realtime;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * The one place a service announces that something changed.
 * <p>
 * Nothing here ever throws into the caller: a change that succeeded is a change that succeeded even
 * if every push about it fails.
 * <p>
 * Use {@link #publishAfterCommit} from inside a {@code @Transactional} method so a push is never
 * sent for a change that is subsequently rolled back - a browser that refetched on a phantom
 * update would show stale data anyway, and "the row you saw is gone" is worse than "no update".
 */
@Component
public class RealtimePublisher {

    private static final Logger log = LoggerFactory.getLogger(RealtimePublisher.class);

    private final RealtimeHub hub;

    public RealtimePublisher(RealtimeHub hub) {
        this.hub = hub;
    }

    /**
     * Announces a change to each of {@code topics}, after the current transaction commits.
     *
     * @param actorEmail the user the user-scoped topics belong to; null for a purely public change
     */
    public void publishAfterCommit(Collection<String> topics, String entityType, UUID entityId,
                                   String actorEmail, String summary) {
        if (topics == null || topics.isEmpty()) {
            return;
        }
        for (String topic : topics) {
            publishAfterCommit(RealtimeEvent.of(topic, entityType, entityId, actorEmail, summary));
        }
    }

    /**
     * Defers delivery to just after commit. With no transaction open there is nothing to wait for,
     * so it is delivered straight away - that is the case for a scheduler or a startup hook.
     */
    public void publishAfterCommit(RealtimeEvent event) {
        if (event == null || event.topic() == null) {
            return;
        }
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            deliver(event);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                deliver(event);
            }
        });
    }

    /** Delivers immediately, ignoring any transaction. For code that is never transactional. */
    public void publishNow(RealtimeEvent event) {
        if (event != null && event.topic() != null) {
            deliver(event);
        }
    }

    private void deliver(RealtimeEvent event) {
        try {
            switch (event.topic()) {
                // Private to the person who caused or is party to the change: their own orders,
                // cart, groups and notifications. A push never widens access - it only says
                // "refetch", and the refetch still goes through the ordinary authorisation checks.
                case RealtimeTopics.ORDERS, RealtimeTopics.CART, RealtimeTopics.SELLER_ACCOUNT,
                     RealtimeTopics.SUPPORT, RealtimeTopics.NOTIFICATIONS ->
                        hub.publishToUser(event.actorEmail(), event);
                // Admins also get the operational stream regardless of who acted, because the point
                // of the admin view is to see other people's activity land.
                case RealtimeTopics.ADMIN -> {
                    hub.publishToUser(event.actorEmail(), event);
                    hub.publishToRole("ROLE_ADMIN", event);
                }
                // These are both private and public at once: "my bids" is personal, while the
                // auction or group page is on the open marketplace. So the participant who is
                // named gets the full event, and everybody else - including anonymous visitors -
                // gets a copy with the actor stripped out.
                //
                // That strip is not cosmetic. The summary names who acted, and an email address
                // must never reach a stranger's browser, so the public copy carries only the fact
                // that something changed.
                case RealtimeTopics.GROUP_BUY, RealtimeTopics.WHOLESALE, RealtimeTopics.AUCTION,
                     RealtimeTopics.GROUP_BUYING_AUCTION, RealtimeTopics.REVERSE_GROUP_BUYING,
                     RealtimeTopics.GROUP_REVERSE -> {
                    hub.publishToUser(event.actorEmail(), event);
                    hub.broadcast(anonymise(event));
                }
                // Catalogue and storefront are public by definition, so they go to every connected
                // browser including anonymous visitors.
                default -> hub.broadcast(anonymise(event));
            }
        } catch (RuntimeException ex) {
            log.warn("Could not deliver realtime event on topic {}: {}",
                    event.topic(), ex.getMessage());
        }
    }

    /** The same change, with everything identifying removed. */
    private RealtimeEvent anonymise(RealtimeEvent event) {
        String genericSummary = event.summary();
        if (genericSummary != null) {
            int by = genericSummary.lastIndexOf(" by ");
            if (by > 0) {
                genericSummary = genericSummary.substring(0, by);
            }
        }
        return new RealtimeEvent(event.topic(), event.entityType(), event.entityId(),
                null, genericSummary, event.occurredAt());
    }

    // ---- Entry points that read like the change they describe. ----

    /** A resource belonging to one user changed. */
    public void userChanged(String topic, String entityType, UUID entityId, String userEmail,
                            String summary) {
        publishAfterCommit(RealtimeEvent.of(topic, entityType, entityId, userEmail, summary));
    }

    /** A product, category or store changed: visible to everyone browsing. */
    public void catalogueChanged(String summary) {
        publishAfterCommit(RealtimeEvent.ofTopic(RealtimeTopics.CATALOGUE, summary));
        publishAfterCommit(RealtimeEvent.ofTopic(RealtimeTopics.STOREFRONT, summary));
    }

    /** A marketplace listing moved on: a group filled, a pool closed, a bid landed. */
    public void storefrontChanged(String entityType, UUID entityId, String summary) {
        publishAfterCommit(RealtimeEvent.of(RealtimeTopics.STOREFRONT, entityType, entityId,
                null, summary));
    }

    /** The recipient should refresh their notification bell. */
    public void notificationFor(String userEmail, String summary) {
        publishAfterCommit(RealtimeEvent.of(RealtimeTopics.NOTIFICATIONS, "notification", null,
                userEmail, summary));
    }

    public static List<String> topics(String... values) {
        return List.of(values);
    }
}
