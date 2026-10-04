package com.groupmart.realtime;

import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Announces every successful write, so a new controller becomes real-time without any work.
 * <p>
 * Business services already describe what they changed in far more detail, and where that detail
 * matters it is published explicitly through {@link RealtimePublisher}. This interceptor is the
 * safety net for everything else: it watches the mutating half of the API, works out from the URL
 * which topics moved, and tells the interested parties. Without it, every one of the ~60 write
 * endpoints would need its own call site, and the first new endpoint someone forgot would silently
 * be the one that needs a page refresh again.
 * <p>
 * It runs in {@code afterCompletion}, by which point the controller's transaction has already
 * committed, so a push never describes a change that was rolled back.
 */
@Component
public class RealtimeChangeInterceptor implements HandlerInterceptor {

    private static final Pattern UUID_IN_PATH = Pattern.compile(
            "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");

    private final RealtimePublisher publisher;

    public RealtimeChangeInterceptor(RealtimePublisher publisher) {
        this.publisher = publisher;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        if (ex != null) {
            return; // The write failed. Nothing changed, so nothing to say.
        }
        if (response.getStatus() < 200 || response.getStatus() >= 300) {
            return; // A 4xx that still ran, or a redirect: not a committed change.
        }
        if (!isMutating(request.getMethod())) {
            return;
        }

        String path = request.getRequestURI();
        if (path == null || path.startsWith("/api/v1/realtime")) {
            return; // Never announce the announcement channel; that would loop.
        }
        if (path.contains("/auth/login") || path.contains("/auth/register")) {
            return; // Signing in changes no shared data.
        }

        List<String> topics = RealtimeTopics.forPath(path);
        if (topics.isEmpty()) {
            return;
        }

        String actor = currentActor();
        UUID entityId = firstUuid(path);
        String summary = actor == null
                ? request.getMethod() + " " + path
                : request.getMethod() + " " + path + " by " + actor;

        for (String topic : topics) {
            publisher.publishNow(RealtimeEvent.of(topic, entityTypeOf(path), entityId, actor, summary));
        }
    }

    private boolean isMutating(String method) {
        return "POST".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method) || "DELETE".equalsIgnoreCase(method);
    }

    /**
     * The authenticated user. Null for an anonymous write (a public cart endpoint, say), in which
     * case only the public topics are delivered - which is exactly what those callers need.
     */
    private String currentActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        String name = authentication.getName();
        return "anonymousUser".equals(name) ? null : name;
    }

    private UUID firstUuid(String path) {
        Matcher matcher = UUID_IN_PATH.matcher(path);
        return matcher.find() ? UUID.fromString(matcher.group()) : null;
    }

    /** A coarse name for the changed thing, e.g. "group-reverse-demand" for a demand URL. */
    private String entityTypeOf(String path) {
        if (path.contains("/group-reverse-demands")) return "group-reverse-demand";
        if (path.contains("/group-buys")) return "group-buy";
        if (path.contains("/wholesale")) return "wholesale-pool";
        if (path.contains("/group-buying-auctions")) return "group-buying-auction";
        if (path.contains("/reverse-group-buying")) return "reverse-group-buying";
        if (path.contains("/auctions")) return "auction";
        if (path.contains("/orders")) return "order";
        if (path.contains("/products")) return "product";
        if (path.contains("/sellers")) return "seller";
        if (path.contains("/notifications")) return "notification";
        if (path.contains("/support")) return "support-message";
        return null;
    }
}
