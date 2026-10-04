package com.groupmart.dto.analytics.sales;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * One order line, flattened with the product and category names the rollup reports.
 *
 * <p>A projection rather than the {@code OrderItem} entity: the category name lives behind a lazy
 * association, so reading it per line would issue a query for every line item on the platform.
 *
 * <p>{@link #getOrderId()} is what lets a line be attributed to the month its order was placed in,
 * which the per-month unit counts depend on.
 */
public interface OrderItemFact {

    UUID getOrderId();

    UUID getProductId();

    String getProductName();

    String getSku();

    int getQuantity();

    BigDecimal getSubtotal();

    String getCategoryName();
}
