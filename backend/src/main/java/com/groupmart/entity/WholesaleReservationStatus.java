package com.groupmart.entity;

public enum WholesaleReservationStatus {
    RESERVED,    // Active reservation, contributing to the pool, payment held
    CANCELLED,   // Cancelled before pool completion; quantity released back to the pool
    CONVERTED,   // Pool completed and an individual order was created
    REFUNDED     // Pool failed, or cancelled after completion; fully refunded
}
