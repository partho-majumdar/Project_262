package com.groupmart.entity;

import java.util.Arrays;
import java.util.List;

/**
 * Groups notification types for the notification bell and user preferences.
 * Mandatory categories cover money and account security, so they cannot be muted.
 */
public enum NotificationCategory {

    GROUP_ACTIVITY("Group buy activity",
            "Members joining or leaving, price drops, goals reached and ending-soon reminders for your groups",
            false, List.of("GROUP_BUY_JOIN", "GROUP_BUY_INVITE", "GROUP_BUY_LEAVE", "GROUP_BUY_PRICE_DROP",
                    "GROUP_BUY_ALMOST", "GROUP_BUY_GOAL", "GROUP_BUY_EXPIRING")),
    GROUP_RESULTS("Group buy results",
            "Group success, failure, orders created and refunds",
            true, List.of("GROUP_BUY_SUCCESS", "GROUP_BUY_FAILED", "GROUP_BUY_REFUND", "GROUP_BUY_DISPUTE")),
    DEAL_ALERTS("Followed deal alerts",
            "New discounts, launches and expiry reminders for group deals you follow",
            false, List.of("GROUP_BUY_DEAL_LIVE", "GROUP_BUY_DEAL_DISCOUNT", "GROUP_BUY_DEAL_ENDING", "GROUP_BUY_DEAL_ENDED")),
    ORDERS("Order updates",
            "Order confirmations and shipping progress",
            false, List.of("ORDER_UPDATE")),
    PAYMENTS("Payments & refunds",
            "Payment confirmations and refunds for your orders",
            true, List.of("PAYMENT_UPDATE")),
    SELLER("Seller campaigns",
            "Approval, launch and results of your group buy campaigns",
            false, List.of("GROUP_BUY_CAMPAIGN", "STOCK_ALERT")),
    PROMOTIONS("Promotions",
            "Coupons, sales and marketing offers",
            false, List.of("PROMO")),
    ACCOUNT("Account & security",
            "Sign-in and account security alerts",
            true, List.of("SECURITY")),
    // Sent only to administrators, so it is always on and not listed in preferences
    ADMIN("Admin alerts",
            "Group buy approvals, disputes and moderation work for administrators",
            true, List.of("GROUP_BUY_ADMIN")),
    OTHER("Other", "Everything else", true, List.of());

    private final String label;
    private final String description;
    private final boolean mandatory;
    private final List<String> types;

    NotificationCategory(String label, String description, boolean mandatory, List<String> types) {
        this.label = label;
        this.description = description;
        this.mandatory = mandatory;
        this.types = types;
    }

    public String getLabel() {
        return label;
    }

    public String getDescription() {
        return description;
    }

    public boolean isMandatory() {
        return mandatory;
    }

    public static NotificationCategory fromType(String type) {
        if (type == null) {
            return OTHER;
        }
        return Arrays.stream(values())
                .filter(category -> category.types.contains(type))
                .findFirst()
                .orElse(OTHER);
    }
}
