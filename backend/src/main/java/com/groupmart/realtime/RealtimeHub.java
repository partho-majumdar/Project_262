package com.groupmart.realtime;

import java.io.IOException;
import java.util.Collection;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Keeps track of every live browser connection and fans change events out to them.
 * <p>
 * Delivery is best-effort and never allowed to break the request that caused it: a write that
 * succeeds is a write that succeeds even if every push fails. A send that throws drops that one
 * connection rather than propagating.
 * <p>
 * Connections are keyed by the user's email rather than by HTTP session, because the app is
 * {@code STATELESS} and a user may legitimately have several tabs open.
 */
@Component
public class RealtimeHub {

    private static final Logger log = LoggerFactory.getLogger(RealtimeHub.class);

    /**
     * Generous, because the connection is meant to stay open all day; the heartbeat below is what
     * actually keeps intermediaries from reaping it. When it does expire the browser reconnects
     * automatically.
     */
    private static final long STREAM_TIMEOUT_MS = 30L * 60L * 1000L;

    private final Map<String, Set<Connection>> byUser = new ConcurrentHashMap<>();
    private final Set<Connection> everyone = ConcurrentHashMap.newKeySet();
    private final AtomicLong published = new AtomicLong();

    /** One open EventSource, with what it asked to hear about. */
    public static final class Connection {
        private final SseEmitter emitter;
        private final String email;
        private final String role;
        private final Set<String> topics;

        Connection(SseEmitter emitter, String email, String role, Set<String> topics) {
            this.emitter = emitter;
            this.email = email;
            this.role = role;
            this.topics = topics;
        }

        String email() {
            return email;
        }

        String role() {
            return role;
        }

        boolean wants(String topic) {
            return topics.contains(topic);
        }

        boolean isAdmin() {
            return "ROLE_ADMIN".equals(role);
        }

        SseEmitter emitter() {
            return emitter;
        }
    }

    /**
     * Opens a stream for one browser.
     *
     * @param email the signed-in user, or null for an anonymous visitor who only wants public topics
     */
    public SseEmitter subscribe(String email, String role, Collection<String> topics) {
        SseEmitter emitter = new SseEmitter(STREAM_TIMEOUT_MS);
        Connection connection = new Connection(emitter, email, role, Set.copyOf(topics));

        everyone.add(connection);
        if (email != null) {
            byUser.computeIfAbsent(email, k -> ConcurrentHashMap.newKeySet()).add(connection);
        }

        // Any completion path - normal close, timeout, or a broken pipe - must free the slot.
        emitter.onCompletion(() -> remove(connection));
        emitter.onTimeout(() -> {
            remove(connection);
            emitter.complete();
        });
        emitter.onError(ex -> remove(connection));

        send(connection, "connected", java.util.Map.of(
                "email", email == null ? "" : email,
                "topics", String.join(",", topics)));
        log.debug("Realtime stream opened for {} ({} topics, {} live)",
                email == null ? "anonymous" : email, topics.size(), everyone.size());
        return emitter;
    }

    private void remove(Connection connection) {
        everyone.remove(connection);
        if (connection.email() != null) {
            Set<Connection> connections = byUser.get(connection.email());
            if (connections != null) {
                connections.remove(connection);
                if (connections.isEmpty()) {
                    byUser.remove(connection.email(), connections);
                }
            }
        }
    }

    /** Tells one user that something they own changed. */
    public void publishToUser(String email, RealtimeEvent event) {
        if (email == null) {
            return;
        }
        Set<Connection> connections = byUser.get(email);
        if (connections == null) {
            return;
        }
        for (Connection connection : connections) {
            if (connection.wants(event.topic())) {
                send(connection, event);
            }
        }
    }

    /** Tells every user holding a role - used for the admin oversight stream. */
    public void publishToRole(String role, RealtimeEvent event) {
        for (Connection connection : everyone) {
            if (role.equals(connection.role()) && connection.wants(event.topic())) {
                send(connection, event);
            }
        }
    }

    /**
     * Tells every connected browser, signed in or not. Reserved for changes that are public by
     * definition - a group filling up, a price changing - so it is safe without authorisation.
     */
    public void broadcast(RealtimeEvent event) {
        for (Connection connection : everyone) {
            if (connection.wants(event.topic())) {
                send(connection, event);
            }
        }
    }

    private void send(Connection connection, RealtimeEvent event) {
        deliver(connection, event.topic(), event.toPayload());
    }

    private void send(Connection connection, String eventName, Map<String, Object> payload) {
        deliver(connection, eventName, payload);
    }

    private void deliver(Connection connection, String eventName, Map<String, Object> payload) {
        try {
            connection.emitter().send(SseEmitter.event().name(eventName).data(payload));
            published.incrementAndGet();
        } catch (IOException | IllegalStateException ex) {
            // The browser navigated away or the connection went bad. That is routine, not an error.
            log.debug("Dropping realtime connection for {}: {}", connection.email(), ex.getMessage());
            remove(connection);
            try {
                connection.emitter().complete();
            } catch (RuntimeException ignored) {
                // Already closed; nothing further to do.
            }
        }
    }

    /**
     * A comment frame every 25s. Proxies and load balancers close connections that look idle, and an
     * SSE stream is idle for most of its life; this keeps it looking alive without the client having
     * to refetch anything.
     */
    @Scheduled(fixedDelay = 25_000L, initialDelay = 25_000L)
    public void heartbeat() {
        for (Connection connection : everyone) {
            try {
                connection.emitter().send(SseEmitter.event().comment("ping"));
            } catch (IOException | IllegalStateException ex) {
                remove(connection);
            }
        }
    }

    public int connectionCount() {
        return everyone.size();
    }

    public long publishedCount() {
        return published.get();
    }

    /** Drops every connection. Used by tests and by a clean shutdown. */
    public void clear() {
        everyone.forEach(c -> {
            try {
                c.emitter().complete();
            } catch (RuntimeException ignored) {
                // Nothing to do - we are tearing down anyway.
            }
        });
        everyone.clear();
        byUser.clear();
    }
}
