package com.groupmart.entity;

/** Why a Reverse Group Buying offer ended without unlocking its purchasing condition. */
public enum ReverseGroupBuyingCloseCode {
    DEADLINE_REACHED_BELOW_TARGET("Participation deadline reached before the target condition was met"),
    CLOSED_EARLY_BY_SELLER("Offer closed early by the seller"),
    CANCELLED_BY_SELLER("Offer cancelled by the seller"),
    OTHER("Reason not recorded");

    private final String label;

    ReverseGroupBuyingCloseCode(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
