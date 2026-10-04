package com.groupmart.entity;

/** Why a group closed without orders. Stored so reports don't have to parse free-text reasons. */
public enum GroupBuyCloseCode {
    NOT_ENOUGH_PARTICIPANTS("Not enough participants by the deadline"),
    CLOSED_EARLY_BELOW_MINIMUM("Closed early below the minimum"),
    ALL_MEMBERS_LEFT("All members left"),
    CANCELLED_BY_SELLER("Campaign cancelled by the seller"),
    CANCELLED_BY_ADMIN("Campaign cancelled by an administrator"),
    GROUP_REMOVED_BY_ADMIN("Group cancelled by an administrator"),
    CAMPAIGN_WINDOW_ENDED("Campaign window ended before launch"),
    OTHER("Reason not recorded");

    private final String label;

    GroupBuyCloseCode(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
