package com.groupmart.realtime;

import java.util.Locale;
import java.util.Optional;

/**
 * The vocabulary of change notifications the server can push.
 * <p>
 * A topic is deliberately coarse: it names <em>the kind of thing that changed</em>, not the exact
 * row. Clients subscribe to topics and refetch the resource they are showing, which keeps the
 * payload small and means a client never has to understand a server-side DTO to stay correct.
 * <p>
 * {@link #CATALOGUE} and {@link #STOREFRONT} are the public marketplace topics, sent to every
 * connected browser so a stranger watching a group fill up sees the progress bar move. The rest are
 * addressed to the participants of a single transaction and are never broadcast.
 */
public final class RealtimeTopics {

    /** A product changed: price, stock, or approval. Seen by everyone browsing the catalogue. */
    public static final String CATALOGUE = "catalogue";

    /** A marketplace listing changed: a group, pool, auction or reverse offer appeared or moved on. */
    public static final String STOREFRONT = "storefront";

    /** This user's own orders changed state. */
    public static final String ORDERS = "orders";

    /** This user's cart or wishlist changed. */
    public static final String CART = "cart";

    /** A group buying group the user is in changed. */
    public static final String GROUP_BUY = "group-buy";

    /** A wholesale pool the user is in changed. */
    public static final String WHOLESALE = "wholesale";

    /** A proxy-bidding auction the user is bidding on changed. */
    public static final String AUCTION = "auction";

    /** A group buying auction the user bid on changed. */
    public static final String GROUP_BUYING_AUCTION = "group-buying-auction";

    /** A seller-initiated reverse group buying demand the user follows changed. */
    public static final String REVERSE_GROUP_BUYING = "reverse-group-buying";

    /** A customer-initiated group reverse demand the user leads or joined changed. */
    public static final String GROUP_REVERSE = "group-reverse";

    /** This user's seller application was decided, or their store was verified. */
    public static final String SELLER_ACCOUNT = "seller-account";

    /** This user's notifications changed - used by the bell to drop its polling. */
    public static final String NOTIFICATIONS = "notifications";

    /** A support conversation the user is part of changed. */
    public static final String SUPPORT = "support";

    /** An admin is watching the platform: seller applications, flagged content, disputes. */
    public static final String ADMIN = "admin";

    /**
     * Works out which topics a mutating request should announce, from its path alone.
     * <p>
     * This is what lets every existing write endpoint become real-time without editing the service
     * layer one method at a time: a new controller gets live updates the day it is written, because
     * the mapping below is a property of the URL, not of the business logic.
     *
     * @return the topics to announce, or empty when the path is not a change worth pushing
     */
    public static java.util.List<String> forPath(String path) {
        if (path == null) {
            return java.util.List.of();
        }
        String p = path.toLowerCase(Locale.ROOT);

        // Ordered most specific first: a write under /admin/... is both an admin event and, often,
        // a change to a storefront a customer is watching.
        java.util.List<String> topics = new java.util.ArrayList<>();
        if (p.contains("/admin/")) {
            topics.add(ADMIN);
        }
        if (p.contains("/orders") || p.contains("/checkout") || p.contains("/payment")) {
            topics.add(ORDERS);
        }
        if (p.contains("/cart") || p.contains("/wishlist")) {
            topics.add(CART);
        }
        if (p.contains("/group-buys") || p.contains("/group-buy/")) {
            topics.add(GROUP_BUY);
        }
        if (p.contains("/wholesale")) {
            topics.add(WHOLESALE);
        }
        if (p.contains("/group-buying-auctions")) {
            topics.add(GROUP_BUYING_AUCTION);
        } else if (p.contains("/auctions")) {
            topics.add(AUCTION);
        }
        if (p.contains("/reverse-group-buying")) {
            topics.add(REVERSE_GROUP_BUYING);
        }
        if (p.contains("/group-reverse-demands")) {
            topics.add(GROUP_REVERSE);
        }
        if (p.contains("/sellers") || p.contains("/seller/") || p.contains("/products")
                || p.contains("/categories")) {
            topics.add(CATALOGUE);
            topics.add(STOREFRONT);
        }
        if (p.contains("/notifications")) {
            topics.add(NOTIFICATIONS);
        }
        if (p.contains("/support")) {
            topics.add(SUPPORT);
        }
        return topics;
    }

    /** The topics every signed-in browser listens to regardless of what it is looking at. */
    public static java.util.List<String> baseline() {
        return java.util.List.of(NOTIFICATIONS);
    }

    /**
     * The topics a user should be told about when the change was made by somebody else, because a
     * seller or admin write changes a resource that customers are also looking at.
     */
    public static java.util.Optional<String> publicMirrorOf(java.util.List<String> topics) {
        if (topics.contains(CATALOGUE) || topics.contains(STOREFRONT)
                || topics.contains(GROUP_BUY) || topics.contains(WHOLESALE)
                || topics.contains(AUCTION) || topics.contains(GROUP_BUYING_AUCTION)
                || topics.contains(REVERSE_GROUP_BUYING) || topics.contains(GROUP_REVERSE)) {
            return Optional.of(STOREFRONT);
        }
        return Optional.empty();
    }
}
