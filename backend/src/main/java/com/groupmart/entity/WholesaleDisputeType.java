package com.groupmart.entity;

/** Dispute reasons at the individual order level (CWP spec section 21). */
public enum WholesaleDisputeType {
    WRONG_QUANTITY("Wrong quantity"),
    WRONG_PRODUCT("Wrong product"),
    DAMAGED_PRODUCT("Damaged product"),
    MISSING_PRODUCT("Missing product"),
    DELIVERY_ISSUE("Delivery issue"),
    OTHER("Other problem");

    private final String label;

    WholesaleDisputeType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
