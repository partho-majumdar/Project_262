package com.groupmart.service.impl;

import com.groupmart.entity.User;

import java.util.Locale;
import java.util.UUID;

/**
 * A stable public pseudonym for a bidder.
 * <p>
 * The project exposes real names and emails in admin and seller DTOs, but a public bid history is
 * readable by anyone, so it must not. The alias is derived from the user id only: the same bidder
 * shows the same label throughout the history without revealing who they are, and it cannot be
 * reversed or guessed from a name.
 */
public final class BidderAlias {

    private static final String ANONYMOUS = "Bidder #????";

    private BidderAlias() {
    }

    public static String of(User user) {
        if (user == null || user.getId() == null) {
            return ANONYMOUS;
        }
        return of(user.getId());
    }

    public static String of(UUID userId) {
        if (userId == null) {
            return ANONYMOUS;
        }
        return "Bidder #" + userId.toString().replace("-", "").substring(0, 4).toUpperCase(Locale.ROOT);
    }
}
