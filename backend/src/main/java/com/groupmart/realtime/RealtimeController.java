package com.groupmart.realtime;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.security.JwtTokenProvider;

import lombok.RequiredArgsConstructor;

/**
 * The single long-lived connection a browser holds to receive change notifications.
 * <p>
 * One stream per tab serves every topic that tab cares about, so opening a dozen pages does not
 * open a dozen connections, and the browser is left to reconnect on its own if the network drops.
 * <p>
 * <b>Why the token is a query parameter.</b> The browser {@code EventSource} API cannot set an
 * {@code Authorization} header - it is not configurable. The usual alternative, a short-lived
 * ticket fetched over the normal authenticated API and then spent here, is the stricter option and
 * is the right thing to move to if these links ever end up in access logs on a shared host. The
 * stream is read-only and grants nothing on its own: every topic it announces still requires the
 * listener to refetch through the ordinary authenticated endpoints.
 */
@RestController
@RequestMapping("/api/v1/realtime")
@RequiredArgsConstructor
public class RealtimeController {

    private final RealtimeHub hub;
    private final JwtTokenProvider jwtTokenProvider;

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@RequestParam(required = false) String token,
                             @RequestParam(required = false) String topics) {
        String email = null;
        String role = null;
        if (token != null && !token.isBlank() && jwtTokenProvider.validateToken(token)) {
            try {
                email = jwtTokenProvider.getEmailFromToken(token);
                role = jwtTokenProvider.getRoleFromToken(token);
            } catch (RuntimeException ex) {
                // A token that fails to parse is treated as no token: the stream still opens, it
                // just only carries public topics.
                email = null;
                role = null;
            }
        }

        Set<String> subscribed = parseTopics(topics);
        subscribed.addAll(RealtimeTopics.baseline());
        // Admins keep the oversight stream open even if the client did not ask for it.
        if ("ROLE_ADMIN".equals(role)) {
            subscribed.add(RealtimeTopics.ADMIN);
            subscribed.add(RealtimeTopics.CATALOGUE);
        }

        return hub.subscribe(email, role, subscribed);
    }

    /** Lets a client recover from a dropped connection and confirm the server is still there. */
    @GetMapping(value = "/status", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ApiResponse<RealtimeStatus>> status() {
        return ResponseEntity.ok(ApiResponse.success("Realtime status fetched successfully",
                new RealtimeStatus(hub.connectionCount(), hub.publishedCount())));
    }

    private Set<String> parseTopics(String raw) {
        Set<String> topics = new LinkedHashSet<>();
        if (raw == null || raw.isBlank()) {
            return topics;
        }
        List<String> requested = new ArrayList<>(Arrays.asList(raw.split(",")));
        requested.stream().map(String::trim).filter(s -> !s.isEmpty()).forEach(topics::add);
        // Only topics the server actually knows about are honoured, so a typo silently subscribes
        // to nothing rather than throwing and killing the connection.
        topics.retainAll(Set.of(
                RealtimeTopics.CATALOGUE, RealtimeTopics.STOREFRONT, RealtimeTopics.ORDERS,
                RealtimeTopics.CART, RealtimeTopics.GROUP_BUY, RealtimeTopics.WHOLESALE,
                RealtimeTopics.AUCTION, RealtimeTopics.GROUP_BUYING_AUCTION,
                RealtimeTopics.REVERSE_GROUP_BUYING, RealtimeTopics.GROUP_REVERSE,
                RealtimeTopics.SELLER_ACCOUNT, RealtimeTopics.NOTIFICATIONS,
                RealtimeTopics.SUPPORT, RealtimeTopics.ADMIN));
        return topics;
    }

    /** Connection and delivery counters, for a quick operational check. */
    public record RealtimeStatus(int connections, long published) {
    }
}
