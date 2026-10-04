package com.groupmart.realtime;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * One thing that changed, as pushed to the browser.
 * <p>
 * The payload is a hint, not a source of truth: it says which topic moved and, when the server
 * happens to know it, which entity moved and who caused it. Clients use it to decide whether the
 * view they are rendering is stale, and then refetch over the normal authenticated API. That keeps
 * every authorisation rule exactly where it already is - a push can never widen what a user may
 * read, because a push only ever says "go look again".
 *
 * @param topic       the kind of change; see {@link RealtimeTopics}
 * @param entityType  coarse entity name such as "group-reverse-demand", or null when unknown
 * @param entityId    the id of the changed row, or null for a topic-wide change
 * @param actorEmail  who caused it, or null for a scheduled/system change
 * @param summary     short human-readable line, used for toasts
 * @param occurredAt  server clock, so a client can drop out-of-order deliveries
 */
public record RealtimeEvent(
        String topic,
        String entityType,
        UUID entityId,
        String actorEmail,
        String summary,
        Instant occurredAt) {

    public static RealtimeEvent of(String topic, String entityType, UUID entityId,
                                   String actorEmail, String summary) {
        return new RealtimeEvent(topic, entityType, entityId, actorEmail, summary, Instant.now());
    }

    public static RealtimeEvent ofTopic(String topic, String summary) {
        return of(topic, null, null, null, summary);
    }

    /**
     * The wire shape. Deliberately flat and string-only: a push is not trusted input on the client,
     * and avoiding nested objects keeps the EventSource handler trivial.
     */
    public Map<String, Object> toPayload() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("topic", topic);
        payload.put("entityType", entityType);
        payload.put("entityId", entityId == null ? null : entityId.toString());
        payload.put("actor", actorEmail);
        payload.put("summary", summary);
        payload.put("occurredAt", occurredAt == null ? null : occurredAt.toString());
        payload.put("id", java.util.UUID.randomUUID().toString());
        return payload;
    }
}
