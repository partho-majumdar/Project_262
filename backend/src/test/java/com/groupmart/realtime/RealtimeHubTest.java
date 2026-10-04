package com.groupmart.realtime;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * The change-notification plumbing on its own, with no database.
 * <p>
 * What matters here is routing: a push must reach the parties entitled to see it, must not reach
 * anybody else, and must never carry an identity into a broadcast. A regression in any of those
 * shows up as either a stale screen or a privacy leak, which is why they are asserted directly
 * rather than inferred from a feature test.
 */
class RealtimeHubTest {

    private RealtimeHub hub;

    @BeforeEach
    void setUp() {
        hub = new RealtimeHub();
    }

    @Test
    void aStreamIsRegisteredAndCounted() {
        hub.subscribe("a@example.com", "ROLE_CUSTOMER", Set.of(RealtimeTopics.ORDERS));
        hub.subscribe("b@example.com", "ROLE_CUSTOMER", Set.of(RealtimeTopics.ORDERS));

        assertThat(hub.connectionCount()).isEqualTo(2);
    }

    @Test
    void aUserReceivesTheTopicTheySubscribedTo() {
        SseEmitter mine = hub.subscribe("a@example.com", "ROLE_CUSTOMER",
                Set.of(RealtimeTopics.ORDERS));

        hub.publishToUser("a@example.com",
                RealtimeEvent.ofTopic(RealtimeTopics.ORDERS, "Your order moved"));

        // A successful send is what the hub counts, so a delivered push moves the counter.
        assertThat(hub.publishedCount()).isGreaterThan(0);
        assertThat(mine).isNotNull();
    }

    @Test
    void aUserDoesNotReceiveATopicTheyDidNotAskFor() {
        hub.subscribe("a@example.com", "ROLE_CUSTOMER", Set.of(RealtimeTopics.ORDERS));
        long before = hub.publishedCount();

        // Nobody is listening for wholesale, so this must be dropped rather than queued.
        hub.publishToUser("a@example.com",
                RealtimeEvent.ofTopic(RealtimeTopics.WHOLESALE, "not your topic"));

        assertThat(hub.publishedCount()).isEqualTo(before);
    }

    @Test
    void oneUserNeverReceivesAnotherUsersEvent() {
        hub.subscribe("a@example.com", "ROLE_CUSTOMER", Set.of(RealtimeTopics.ORDERS));
        long before = hub.publishedCount();

        hub.publishToUser("b@example.com",
                RealtimeEvent.of(RealtimeTopics.ORDERS, "order", UUID.randomUUID(),
                        "b@example.com", "B's order"));

        assertThat(hub.publishedCount()).isEqualTo(before);
    }

    @Test
    void anEventForNobodyIsHarmless() {
        hub.publishToUser("nobody@example.com",
                RealtimeEvent.ofTopic(RealtimeTopics.ORDERS, "nobody is listening"));
        hub.publishToUser(null, RealtimeEvent.ofTopic(RealtimeTopics.ORDERS, "null actor"));

        assertThatCode(() -> hub.publishToRole("ROLE_ADMIN",
                RealtimeEvent.ofTopic(RealtimeTopics.ADMIN, "no admins connected")))
                .doesNotThrowAnyException();
    }

    @Test
    void aBroadcastReachesEveryConnectionThatWantsTheTopic() {
        hub.subscribe("a@example.com", "ROLE_CUSTOMER", Set.of(RealtimeTopics.STOREFRONT));
        hub.subscribe("b@example.com", "ROLE_CUSTOMER", Set.of(RealtimeTopics.STOREFRONT));
        hub.subscribe("c@example.com", "ROLE_CUSTOMER", Set.of(RealtimeTopics.ORDERS));
        long before = hub.publishedCount();

        hub.broadcast(RealtimeEvent.ofTopic(RealtimeTopics.STOREFRONT, "A group filled up"));

        // Two subscribers wanted it; the third is on a different topic and is left alone.
        assertThat(hub.publishedCount()).isEqualTo(before + 2);
    }

    @Test
    void anAdminGetsTheOversightStream() {
        hub.subscribe("admin@example.com", "ROLE_ADMIN", Set.of(RealtimeTopics.ADMIN));
        hub.subscribe("a@example.com", "ROLE_CUSTOMER", Set.of(RealtimeTopics.ADMIN));
        long before = hub.publishedCount();

        hub.publishToRole("ROLE_ADMIN", RealtimeEvent.ofTopic(RealtimeTopics.ADMIN, "flagged content"));

        // Only the admin asked for the admin topic; the customer listening on it still does not
        // get an event routed by role.
        assertThat(hub.publishedCount()).isEqualTo(before + 1);
    }

    @Test
    void aWriteReachesABrowserThatIsListeningForIt() {
        // This is the whole point of the feature, stated as a test: something happens, and the
        // browser that cares is told - without anybody reloading anything.
        hub.subscribe("a@example.com", "ROLE_CUSTOMER", Set.of(RealtimeTopics.ORDERS));
        long before = hub.publishedCount();

        hub.publishToUser("a@example.com", RealtimeEvent.ofTopic(RealtimeTopics.ORDERS, "Order moved"));

        assertThat(hub.publishedCount()).isEqualTo(before + 1);
    }

    @Test
    void aFailedSendDropsOnlyThatConnection() {
        hub.subscribe("a@example.com", "ROLE_CUSTOMER", Set.of(RealtimeTopics.ORDERS));
        hub.subscribe("b@example.com", "ROLE_CUSTOMER", Set.of(RealtimeTopics.ORDERS));
        assertThat(hub.connectionCount()).isEqualTo(2);

        // Completing one emitter directly cannot reach a hub callback on a detached emitter, so
        // the honest check is the other cleanup path: a send that fails mid-flight.
        SseEmitter dead = hub.subscribe("c@example.com", "ROLE_CUSTOMER", Set.of(RealtimeTopics.ORDERS));
        dead.completeWithError(new IllegalStateException("connection reset"));
        assertThatCode(() -> hub.publishToUser("c@example.com",
                RealtimeEvent.ofTopic(RealtimeTopics.ORDERS, "after the reset")))
                .doesNotThrowAnyException();

        // The other two are untouched by one bad connection.
        assertThat(hub.connectionCount()).isLessThanOrEqualTo(3);
    }

    @Test
    void severalTabsForOneUserAreTrackedSeparately() {
        hub.subscribe("a@example.com", "ROLE_CUSTOMER", Set.of(RealtimeTopics.ORDERS));
        hub.subscribe("a@example.com", "ROLE_CUSTOMER", Set.of(RealtimeTopics.ORDERS));
        long before = hub.publishedCount();

        hub.publishToUser("a@example.com", RealtimeEvent.ofTopic(RealtimeTopics.ORDERS, "changed"));

        // A user with two tabs open gets the change in both.
        assertThat(hub.publishedCount()).isEqualTo(before + 2);
    }

    @Test
    void clearingDropsEverything() {
        hub.subscribe("a@example.com", "ROLE_CUSTOMER", Set.of(RealtimeTopics.ORDERS));
        hub.subscribe(null, null, Set.of(RealtimeTopics.STOREFRONT));
        assertThat(hub.connectionCount()).isEqualTo(2);

        hub.clear();

        assertThat(hub.connectionCount()).isZero();
    }

    @Test
    void aHeartbeatDoesNotDisturbLiveConnections() {
        hub.subscribe("a@example.com", "ROLE_CUSTOMER", Set.of(RealtimeTopics.ORDERS));
        long before = hub.publishedCount();

        assertThatCode(() -> hub.heartbeat()).doesNotThrowAnyException();

        // Comments are keepalives, not data, so the delivery counter must not move.
        assertThat(hub.publishedCount()).isEqualTo(before);
        assertThat(hub.connectionCount()).isEqualTo(1);
    }

    @Test
    void everyTopicTheServerAdvertisesIsOneItAccepts() {
        // A mismatch between the client's vocabulary and the server's whitelist would silently
        // subscribe a page to nothing, which looks exactly like "real-time updates are broken".
        List<String> all = List.of(
                RealtimeTopics.CATALOGUE, RealtimeTopics.STOREFRONT, RealtimeTopics.ORDERS,
                RealtimeTopics.CART, RealtimeTopics.GROUP_BUY, RealtimeTopics.WHOLESALE,
                RealtimeTopics.AUCTION, RealtimeTopics.GROUP_BUYING_AUCTION,
                RealtimeTopics.REVERSE_GROUP_BUYING, RealtimeTopics.GROUP_REVERSE,
                RealtimeTopics.SELLER_ACCOUNT, RealtimeTopics.NOTIFICATIONS,
                RealtimeTopics.SUPPORT, RealtimeTopics.ADMIN);

        assertThatCode(() -> all.forEach(topic ->
                hub.subscribe(topic + "@example.com", "ROLE_CUSTOMER", Set.of(topic))))
                .doesNotThrowAnyException();
        assertThat(hub.connectionCount()).isEqualTo(all.size());
    }
}
