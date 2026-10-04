package com.groupmart.common.constant;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Canonical platform setting keys with their default values.
 *
 * <p>The admin settings screen renders from this set, so every key the UI can edit
 * must exist here. Defaults are served even when the {@code platform_settings}
 * table has no persisted row, which keeps the screen renderable on a database
 * where seeding has not run.
 */
public final class PlatformSettingKeys {

    public static final String PAYMENT_STRIPE_ENABLED = "payment.stripe.enabled";
    public static final String PAYMENT_PAYPAL_ENABLED = "payment.paypal.enabled";
    public static final String PAYMENT_CREDIT_CARD_ENABLED = "payment.creditcard.enabled";
    public static final String SHIPPING_TIER = "shipping.tier";
    public static final String COMMISSION_RATE = "commission.rate";
    public static final String WITHHOLDING_TAX_RATE = "withholding.tax.rate";
    public static final String ORDER_AUTO_CANCEL_HOURS = "order.autoCancel.hours";

    private PlatformSettingKeys() {
    }

    /**
     * @return default key/value pairs in a stable display order.
     */
    public static Map<String, String> defaults() {
        Map<String, String> defaults = new LinkedHashMap<>();
        defaults.put(PAYMENT_STRIPE_ENABLED, "true");
        defaults.put(PAYMENT_PAYPAL_ENABLED, "true");
        defaults.put(PAYMENT_CREDIT_CARD_ENABLED, "true");
        defaults.put(SHIPPING_TIER, "Flat Rate ৳5.00");
        defaults.put(COMMISSION_RATE, "15.0");
        defaults.put(WITHHOLDING_TAX_RATE, "18.0");
        defaults.put(ORDER_AUTO_CANCEL_HOURS, "48");
        return defaults;
    }

    /**
     * @return human readable descriptions keyed by setting key.
     */
    public static Map<String, String> descriptions() {
        Map<String, String> descriptions = new LinkedHashMap<>();
        descriptions.put(PAYMENT_STRIPE_ENABLED, "Enable the Stripe (credit/debit card) gateway");
        descriptions.put(PAYMENT_PAYPAL_ENABLED, "Enable the PayPal gateway");
        descriptions.put(PAYMENT_CREDIT_CARD_ENABLED, "Enable direct credit card checkout");
        descriptions.put(SHIPPING_TIER, "Active shipping delivery tier");
        descriptions.put(COMMISSION_RATE, "Platform commission rate percentage");
        descriptions.put(WITHHOLDING_TAX_RATE, "Withholding tax rate percentage");
        descriptions.put(ORDER_AUTO_CANCEL_HOURS, "Hours before an unpaid order is auto-cancelled");
        return descriptions;
    }
}
