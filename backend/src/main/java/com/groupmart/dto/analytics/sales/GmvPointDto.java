package com.groupmart.dto.analytics.sales;

import java.math.BigDecimal;
import java.time.LocalDate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One bucket of marketplace trading: a day, a week or a month, depending on the requested
 * granularity.
 *
 * <p>Deliberately not named "monthly". A period-agnostic name is what lets the same DTO and the
 * same chart carry a 90-point daily series and a 36-point monthly one without a parallel set of
 * fields.
 *
 * <p>{@link #period} is the sortable {@code yyyy-MM-dd} / {@code yyyy-Www} / {@code yyyy-MM} key the
 * series is ordered and joined on; {@link #label} is the display form. Keeping the two separate
 * means sorting never parses a localised string, which is what made the original daily rollup
 * collide across years.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GmvPointDto {

    /** Sortable period key. */
    private String period;

    /** Human-readable period, for example {@code 30 Sep}, {@code W36} or {@code Sep 2026}. */
    private String label;

    /** Order value placed in the bucket, excluding cancelled orders. */
    private BigDecimal gmv;

    private long orderCount;

    /** Units sold across every order in the bucket. */
    private long unitCount;

    private long buyerCount;

    /** {@code gmv / orderCount}, or zero for a bucket with no orders. */
    private BigDecimal averageOrderValue;

    /** How much of the bucket's GMV discounts removed. */
    private BigDecimal discountAmount;

    /** First day of the bucket, so a client can bucket without re-parsing the key. */
    private LocalDate periodStart;
}
