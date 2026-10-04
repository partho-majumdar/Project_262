package com.groupmart.entity;

/**
 * Campaign lifecycle. There is deliberately no PENDING_APPROVAL or REJECTED state: a seller
 * publishes straight from DRAFT to SCHEDULED/ACTIVE, and the admin side is monitoring-only.
 */
public enum GroupBuyCampaignStatus {
    DRAFT,
    SCHEDULED,
    ACTIVE,
    PAUSED,
    SUCCESS,
    FAILED,
    CANCELLED;

    public boolean isTerminal() {
        return this == SUCCESS || this == FAILED || this == CANCELLED;
    }
}
