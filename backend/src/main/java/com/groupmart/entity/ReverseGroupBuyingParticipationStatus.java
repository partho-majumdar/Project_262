package com.groupmart.entity;

/** Status of one customer's independent participation in a Reverse Group Buying offer. */
public enum ReverseGroupBuyingParticipationStatus {
    PARTICIPATING, // Demand is accumulating toward the target condition
    CONVERTED,    // Purchasing condition unlocked; this participation became its own order
    CANCELLED,    // Withdrawn before activation; quantity released and payment refunded
    REFUNDED      // Offer failed or closed before the target; quantity released and payment refunded
}
