package com.groupmart.dto.analytics.sales;

import java.math.BigDecimal;

/**
 * Aggregate read model for "value and count over a span", returned by a single SQL aggregate.
 *
 * <p>Exists so the rollup never has to load order entities just to add up money.
 */
public interface GmvTotal {

    BigDecimal getGmv();

    long getOrderCount();
}
