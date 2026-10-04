package com.groupmart.entity;

public enum GroupBuyParticipantStatus {
    JOINED,     // active member of an open group, payment held
    LEFT,       // left before the group closed, fully refunded
    CONVERTED,  // group succeeded and an order was created
    REFUNDED    // group failed or was cancelled, fully refunded
}
