package com.groupmart.dto.analytics.sales;

import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** GMV split by a single-dimension column on the order, such as the payment gateway used. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BreakdownGmvDto {

    /** The raw stored value, or {@code UNSPECIFIED} where the column was left null. */
    private String name;

    private String label;

    private BigDecimal gmv;

    private long orderCount;

    /** Share of the reported GMV, 0-100. */
    private double percentage;
}
