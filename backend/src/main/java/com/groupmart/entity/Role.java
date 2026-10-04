package com.groupmart.entity;

public enum Role {
    ROLE_CUSTOMER,
    ROLE_SELLER,
    ROLE_ADMIN;

    public String authority() {
        return name();
    }

    public String shortName() {
        return name().replaceFirst("^ROLE_", "");
    }
}
