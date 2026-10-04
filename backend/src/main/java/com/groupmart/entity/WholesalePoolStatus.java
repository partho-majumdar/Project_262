package com.groupmart.entity;

/** Status of one live CWP pool/lot instance, per the CWP spec's "Offer / Pool Status" list. */
public enum WholesalePoolStatus {
    OPEN,               // Accepting reservations
    ALMOST_COMPLETE,    // Pooled quantity close to the wholesale minimum
    COMPLETED,          // Wholesale minimum reached; allocations locked, no new reservations
    PROCESSING,         // Seller preparing the confirmed wholesale purchase
    FULFILLMENT,        // Individual customer orders being processed/shipped
    CLOSED,             // No longer accepting participation (seller closed manually)
    FAILED;             // Deadline reached without the required minimum quantity

    public boolean isTerminal() {
        return this == FULFILLMENT || this == CLOSED || this == FAILED;
    }

    public boolean acceptsReservations() {
        return this == OPEN || this == ALMOST_COMPLETE;
    }
}
