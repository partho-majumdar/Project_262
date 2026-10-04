package com.groupmart.dto.analytics.sales;

import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * GMV attributed to one purchasing mechanism.
 *
 * <p>Backed by {@code Order.orderType}, so a regular basket and a wholesale lot are never merged
 * into a single undifferentiated "sales" line.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FeatureGmvDto {

    /** The {@code OrderType} name, or {@code STANDARD} for legacy rows with a null type. */
    private String feature;

    private String label;

    private BigDecimal gmv;

    private long orderCount;

    /** Share of the reported GMV, 0-100. */
    private double percentage;
}
