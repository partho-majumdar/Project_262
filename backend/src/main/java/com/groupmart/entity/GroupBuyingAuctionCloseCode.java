package com.groupmart.entity;

/** Why a Group Buying Auction ended. Stored so reports never parse free-text reasons. */
public enum GroupBuyingAuctionCloseCode {
    DEADLINE_REACHED("Auction end time reached"),
    CLOSED_EARLY_BY_SELLER("Auction finalized early by the seller"),
    DEADLINE_REACHED_BELOW_MINIMUM("Auction ended without reaching the minimum collective quantity"),
    CANCELLED_BY_SELLER("Auction cancelled by the seller"),
    OTHER("Reason not recorded");

    private final String label;

    GroupBuyingAuctionCloseCode(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
