package com.groupmart.entity;

public enum GroupBuyDisputeType {
    ITEM_NOT_RECEIVED("Item not received"),
    ITEM_DAMAGED_OR_WRONG("Item damaged or not as described"),
    WRONG_PRICE_CHARGED("Charged the wrong price"),
    REFUND_NOT_RECEIVED("Refund not received"),
    UNFAIR_GROUP_OUTCOME("Group closed unfairly"),
    OTHER("Other problem");

    private final String label;

    GroupBuyDisputeType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
