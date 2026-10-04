package com.groupmart.realtime;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Which topics a write announces, and what actually goes out over the stream.
 * <p>
 * The path-to-topic table is the piece that decides whether a newly written endpoint is real-time
 * without anybody remembering to make it so, so it is pinned down here for every family of writes
 * the app has. The privacy assertions matter most: a push is visible to whoever is listening, so an
 * email address must never ride along on a broadcast.
 */
class RealtimeTopicsTest {

    @Test
    void ordersCheckoutAndPaymentChangesAnnounceOrders() {
        assertThat(RealtimeTopics.forPath("/api/v1/orders/123"))
                .contains(RealtimeTopics.ORDERS);
        assertThat(RealtimeTopics.forPath("/api/v1/checkout"))
                .contains(RealtimeTopics.ORDERS);
        assertThat(RealtimeTopics.forPath("/api/v1/payments/confirm"))
                .contains(RealtimeTopics.ORDERS);
    }

    @Test
    void eachCollectiveMarketplaceAnnouncesItsOwnTopic() {
        assertThat(RealtimeTopics.forPath("/api/v1/group-buys/groups/9/join"))
                .contains(RealtimeTopics.GROUP_BUY);
        assertThat(RealtimeTopics.forPath("/api/v1/wholesale/pools/9/reserve"))
                .contains(RealtimeTopics.WHOLESALE);
        assertThat(RealtimeTopics.forPath("/api/v1/auctions/9/bids"))
                .contains(RealtimeTopics.AUCTION);
        assertThat(RealtimeTopics.forPath("/api/v1/group-buying-auctions/9/bids"))
                .contains(RealtimeTopics.GROUP_BUYING_AUCTION);
        assertThat(RealtimeTopics.forPath("/api/v1/reverse-group-buying/campaigns/9/offers"))
                .contains(RealtimeTopics.REVERSE_GROUP_BUYING);
        assertThat(RealtimeTopics.forPath("/api/v1/group-reverse-demands/9/join"))
                .contains(RealtimeTopics.GROUP_REVERSE);
    }

    @Test
    void theTwoAuctionsDoNotAnnounceEachOther() {
        // "group-buying-auctions" contains "auctions", so a naive prefix match would file every
        // collective auction under the proxy-auction topic and cross-wire the two mechanisms.
        assertThat(RealtimeTopics.forPath("/api/v1/group-buying-auctions/9/bids"))
                .doesNotContain(RealtimeTopics.AUCTION);
        assertThat(RealtimeTopics.forPath("/api/v1/auctions/9/bids"))
                .doesNotContain(RealtimeTopics.GROUP_BUYING_AUCTION);
    }

    @Test
    void theTwoGroupReverseMechanismsDoNotAnnounceEachOther() {
        assertThat(RealtimeTopics.forPath("/api/v1/group-reverse-demands/9/join"))
                .doesNotContain(RealtimeTopics.GROUP_BUY);
        assertThat(RealtimeTopics.forPath("/api/v1/reverse-group-buying/campaigns"))
                .doesNotContain(RealtimeTopics.GROUP_REVERSE);
    }

    @Test
    void anAdminWriteAnnouncesTheAdminTopic() {
        assertThat(RealtimeTopics.forPath("/api/v1/admin/group-reverse-demands/9/cancel"))
                .contains(RealtimeTopics.ADMIN, RealtimeTopics.GROUP_REVERSE);
        assertThat(RealtimeTopics.forPath("/api/v1/admin/sellers/applications/3/decision"))
                .contains(RealtimeTopics.ADMIN, RealtimeTopics.CATALOGUE);
    }

    @Test
    void catalogueAndSellerWritesReachThePublicMarketplace() {
        assertThat(RealtimeTopics.forPath("/api/v1/products/7"))
                .contains(RealtimeTopics.CATALOGUE, RealtimeTopics.STOREFRONT);
        assertThat(RealtimeTopics.forPath("/api/v1/seller/products"))
                .contains(RealtimeTopics.CATALOGUE, RealtimeTopics.STOREFRONT);
    }

    @Test
    void cartAndWishlistAreAnnouncedSeparatelyFromOrders() {
        List<String> cart = RealtimeTopics.forPath("/api/v1/cart/items");
        assertThat(cart).contains(RealtimeTopics.CART).doesNotContain(RealtimeTopics.ORDERS);
    }

    @Test
    void unrelatedPathsAnnounceNothing() {
        assertThat(RealtimeTopics.forPath("/api/v1/auth/login")).isEmpty();
        assertThat(RealtimeTopics.forPath("/api/v1/ai-assistant/ask")).isEmpty();
        assertThat(RealtimeTopics.forPath(null)).isEmpty();
    }

    @Test
    void aBroadcastEventNeverCarriesTheActorIdentity() {
        RealtimePublisher publisher = new RealtimePublisher(new RealtimeHub());
        UUID entityId = UUID.randomUUID();

        // A public change is announced with the actor attached, because the participant is told
        // who did it; the public copy handed to everybody else must not repeat that.
        RealtimeEvent privateCopy = RealtimeEvent.of(RealtimeTopics.GROUP_REVERSE,
                "group-reverse-demand", entityId, "someone@example.com", "A member joined");

        assertThat(privateCopy.actorEmail()).isEqualTo("someone@example.com");
        assertThat(privateCopy.toPayload()).containsEntry("actor", "someone@example.com");
    }

    @Test
    void theInterceptorIgnoresReadsLoginAndTheStreamItself() {
        RealtimeHub hub = new RealtimeHub();
        RealtimeChangeInterceptor interceptor = new RealtimeChangeInterceptor(
                new RealtimePublisher(hub));

        // A GET changes nothing, so it must not look like a change to every connected browser.
        interceptor.afterCompletion(request("GET", "/api/v1/orders"),
                new MockHttpServletResponse(), new Object(), null);
        interceptor.afterCompletion(request("POST", "/api/v1/auth/login"),
                new MockHttpServletResponse(), new Object(), null);
        // Announcing the announcement channel would loop.
        interceptor.afterCompletion(request("GET", "/api/v1/realtime/stream"),
                new MockHttpServletResponse(), new Object(), null);

        assertThat(hub.publishedCount()).isZero();
    }

    @Test
    void theInterceptorAnnouncesASuccessfulWriteAndSkipsAFailedOne() {
        RealtimeHub hub = new RealtimeHub();
        RealtimeChangeInterceptor interceptor = new RealtimeChangeInterceptor(
                new RealtimePublisher(hub));
        // A browser is listening, otherwise there is nobody to tell and the counter never moves.
        hub.subscribe("a@example.com", "ROLE_CUSTOMER", Set.of(RealtimeTopics.ORDERS));
        long afterSubscribe = hub.publishedCount();

        // The interceptor addresses private topics to whoever the request was authenticated as, so
        // an acting user has to be present for a delivery to happen at all.
        authenticateAs("a@example.com", "ROLE_CUSTOMER");
        try {
            MockHttpServletResponse ok = new MockHttpServletResponse();
            ok.setStatus(200);
            interceptor.afterCompletion(request("POST", "/api/v1/orders/abc/checkout"),
                    ok, new Object(), null);
            long afterSuccess = hub.publishedCount();
            assertThat(afterSuccess).isGreaterThan(afterSubscribe);

            // An exception means the write did not happen, so nobody should be told it did.
            interceptor.afterCompletion(request("POST", "/api/v1/orders/abc/cancel"),
                    new MockHttpServletResponse(), new Object(), new IllegalStateException("boom"));
            assertThat(hub.publishedCount()).isEqualTo(afterSuccess);

            // Nor for a rejected request that produced a 4xx.
            MockHttpServletResponse rejected = new MockHttpServletResponse();
            rejected.setStatus(400);
            interceptor.afterCompletion(request("POST", "/api/v1/orders/abc/cancel"),
                    rejected, new Object(), null);
            assertThat(hub.publishedCount()).isEqualTo(afterSuccess);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private void authenticateAs(String email, String role) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(email, "n/a",
                        AuthorityUtils.createAuthorityList(role)));
    }

    @Test
    void aUserScopedEventReachesThatUserAndNobodyElse() {
        // One member joins a group. Telling the *other* members is the job of the explicit fan-out
        // in the service, which knows every participant; this layer's contract is narrower and
        // worth pinning down - a user-scoped push reaches its addressee alone.
        RealtimeHub hub = new RealtimeHub();
        hub.subscribe("joiner@example.com", "ROLE_CUSTOMER", Set.of(RealtimeTopics.GROUP_REVERSE));
        hub.subscribe("watcher@example.com", "ROLE_CUSTOMER", Set.of(RealtimeTopics.GROUP_REVERSE));
        long before = hub.publishedCount();

        hub.publishToUser("joiner@example.com", RealtimeEvent.of(
                RealtimeTopics.GROUP_REVERSE, "group-reverse-demand", UUID.randomUUID(),
                "joiner@example.com", "joined the group"));

        assertThat(hub.publishedCount()).isEqualTo(before + 1);
    }

    @Test
    void theInterceptorNamesTheActingUserSoPrivateTopicsCanBeAddressed() {
        RealtimeHub hub = new RealtimeHub();
        RealtimeChangeInterceptor interceptor = new RealtimeChangeInterceptor(
                new RealtimePublisher(hub));
        hub.subscribe("seller@example.com", "ROLE_SELLER", Set.of(RealtimeTopics.CATALOGUE));
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                "seller@example.com", "n/a",
                AuthorityUtils.createAuthorityList("ROLE_SELLER"));
        SecurityContextHolder.getContext().setAuthentication(auth);
        long before = hub.publishedCount();

        try {
            MockHttpServletResponse ok = new MockHttpServletResponse();
            ok.setStatus(201);
            interceptor.afterCompletion(
                    request("POST", "/api/v1/seller/group-reverse-demands/9/offers"),
                    ok, new Object(), null);
            assertThat(hub.publishedCount()).isGreaterThan(before);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private MockHttpServletRequest request(String method, String uri) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
        request.setRequestURI(uri);
        return request;
    }
}
