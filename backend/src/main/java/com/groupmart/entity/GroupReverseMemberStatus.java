package com.groupmart.entity;

/** One member's position in a group reverse demand. */
public enum GroupReverseMemberStatus {
    /** Counted towards the group target; the member may still leave. */
    JOINED,
    /** The member withdrew, or the demand was cancelled, before an offer was selected. */
    CANCELLED,
    /** An offer was selected and this member's quantity and price are locked. */
    CONFIRMED,
    /** This member's individual order has been generated. */
    ORDER_CREATED;

    /** Only a member still counting towards the target can be cancelled. */
    public boolean isActive() {
        return this == JOINED;
    }
}
