package com.groupmart.entity;

/** Why a proxy auction stopped accepting bids, shown to the seller and in the admin view. */
public enum AuctionCloseCode {
    DEADLINE_REACHED("Deadline reached"),
    CLOSED_EARLY_BY_SELLER("Closed early by the seller"),
    DEADLINE_REACHED_NO_BIDS("Deadline reached with no bids"),
    RESERVE_NOT_MET("Reserve price not met"),
    CANCELLED_BY_SELLER("Cancelled by the seller"),
    CANCELLED_BY_ADMIN("Cancelled by an admin"),
    STOCK_UNAVAILABLE("Stock became unavailable"),
    OTHER("Other");

    private final String label;

    AuctionCloseCode(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
