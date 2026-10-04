package com.groupmart.entity;

/**
 * Lifecycle of a Reverse Group Buying offer.
 * <p>
 * Reverse Group Buying is independent of Collaborative Wholesale Purchasing: customers build up
 * collective <em>demand</em> and, once the seller-defined target condition is met, the purchasing
 * condition is unlocked and each customer's own order is created. No wholesale minimum and no
 * fixed wholesale price is involved.
 * <p>
 * OPEN -> ALMOST_COMPLETE -> TARGET_REACHED -> ACTIVATED -> PROCESSING -> FULFILLMENT -> COMPLETED,
 * plus the two early exits CLOSED (seller stopped it) and FAILED (deadline passed unmet).
 */
public enum ReverseGroupBuyingOfferStatus {
    DRAFT,            // Saved by the seller, not yet visible to customers
    OPEN,             // Accepting customer demand
    ALMOST_COMPLETE,  // Collective demand close to the target condition
    TARGET_REACHED,   // Target condition met; purchasing condition about to be unlocked
    ACTIVATED,        // Purchasing condition unlocked
    PROCESSING,       // Individual customer orders have been generated
    FULFILLMENT,      // Seller is processing/shipping the individual orders
    COMPLETED,        // Every individual order was delivered
    CLOSED,           // Seller stopped the offer before the target was reached
    FAILED,           // Deadline passed before the target condition was met
    CANCELLED;        // Seller cancelled the offer

    public boolean isTerminal() {
        return this == COMPLETED || this == CLOSED || this == FAILED || this == CANCELLED;
    }

    /** Only these states still accept new customer demand. */
    public boolean acceptsDemand() {
        return this == OPEN || this == ALMOST_COMPLETE;
    }

    /** From here on individual orders exist, so demand can no longer change. */
    public boolean isActivatedOrBeyond() {
        return this == ACTIVATED || this == PROCESSING || this == FULFILLMENT || this == COMPLETED;
    }
}
