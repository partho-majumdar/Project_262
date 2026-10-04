package com.groupmart.entity;

/** Why a group reverse demand stopped taking action. */
public enum GroupReverseCloseCode {
    TARGET_REACHED_AND_COMPLETED("Group demand fulfilled"),
    LEADER_CANCELLED("Cancelled by the demand creator"),
    JOIN_DEADLINE_PASSED_TARGET_UNMET("Join deadline passed before the group target was met"),
    OFFER_DEADLINE_PASSED_NO_OFFERS("Offer deadline passed with no seller offer"),
    OFFER_DEADLINE_PASSED_UNSELECTED("Offer deadline passed without the creator selecting an offer"),
    ADMIN_CANCELLED("Cancelled by an administrator"),
    STOCK_UNAVAILABLE("The product could no longer supply the group quantity"),
    OTHER("Reason not recorded");

    private final String label;

    GroupReverseCloseCode(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
