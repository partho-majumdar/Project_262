package com.groupmart.entity;

public enum GroupBuyDisputeStatus {
    OPEN,
    UNDER_REVIEW,
    RESOLVED,
    REJECTED;

    public boolean isClosed() {
        return this == RESOLVED || this == REJECTED;
    }
}
