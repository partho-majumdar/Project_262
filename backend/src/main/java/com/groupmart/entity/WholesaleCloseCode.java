package com.groupmart.entity;

/** Why a pool or an offer closed without completing. Stored so reports don't have to parse free-text reasons. */
public enum WholesaleCloseCode {
    DEADLINE_REACHED_BELOW_MINIMUM("Reservation deadline reached before the wholesale minimum was met"),
    DEADLINE_REACHED("Reservation deadline reached"),
    CLOSED_EARLY_BY_SELLER("Pool closed early by the seller"),
    CANCELLED_BY_SELLER("Offer cancelled by the seller"),
    CANCELLED_BY_ADMIN("Offer cancelled by an administrator"),
    OTHER("Reason not recorded");

    private final String label;

    WholesaleCloseCode(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
