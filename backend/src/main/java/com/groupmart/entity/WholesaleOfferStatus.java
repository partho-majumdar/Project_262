package com.groupmart.entity;

/**
 * Lifecycle of the seller's offer configuration, separate from a live pool's own status. Sellers
 * activate their own offers directly - there is no admin approval gate.
 */
public enum WholesaleOfferStatus {
    DRAFT,
    ACTIVE,
    PAUSED,
    CLOSED,
    CANCELLED;

    public boolean isTerminal() {
        return this == CLOSED || this == CANCELLED;
    }
}
