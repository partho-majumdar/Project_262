package com.groupmart.dto.analytics.sales;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import com.groupmart.dto.analytics.CategorySalesDto;
import com.groupmart.dto.analytics.TopProductAnalyticsDto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Everything the marketplace GMV surface needs, computed once on the server.
 *
 * <p>Two deliberate choices shape this DTO.
 *
 * <p>First, it is scoped to a trailing window ({@link #bucketCount} buckets of
 * {@link #granularity}) rather than "all time", because a growth figure is meaningless without one.
 * Every windowed field below describes exactly the same span, and {@link #previousPeriodGmv} is the
 * immediately preceding span of equal length, so the growth percentages compare like with like.
 * Lifetime totals are reported separately under explicitly named fields and are never mixed into
 * the windowed series.
 *
 * <p>Second, GMV is defined once and reused: the order value placed, excluding cancelled orders.
 * The components it is made of are also reported ({@link #netMerchandiseValue},
 * {@link #discountAmount}, {@link #taxAmount}, {@link #shippingAmount}) so the headline number can
 * be reconciled by hand, and the value removed by cancellation is reported alongside it rather
 * than silently dropped.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MarketplaceSalesPerformanceDto {

    // ---- Scope ---------------------------------------------------------
    private LocalDateTime generatedAt;
    /** Inclusive first instant of the reporting window. */
    private LocalDateTime periodStart;
    /** Inclusive last instant of the reporting window. */
    private LocalDateTime periodEnd;

    /** Bucket width the series was built with: {@code DAY}, {@code WEEK} or {@code MONTH}. */
    private String granularity;

    /** How many buckets the series contains. */
    private int bucketCount;

    /** Plural noun for the bucket width, so a client need not hardcode it. */
    private String bucketUnit;

    // ---- Headline ------------------------------------------------------
    /** Order value placed in the window, excluding cancelled orders. */
    private BigDecimal gmv;
    private long orderCount;
    private long unitCount;
    private long buyerCount;
    private BigDecimal averageOrderValue;

    // ---- What GMV is made of -------------------------------------------
    /** Sum of item subtotals, before discount, tax and shipping. */
    private BigDecimal netMerchandiseValue;
    private BigDecimal discountAmount;
    private BigDecimal taxAmount;
    private BigDecimal shippingAmount;

    // ---- Value that is not in GMV, reported rather than hidden ---------
    /**
     * Cancelled orders are the only rows excluded from GMV, which keeps this report reconciling
     * against the older {@code /admin/analytics} rollup. The value they carried is reported here
     * so nothing disappears between "value placed" and "value counted".
     */
    private long cancelledOrderCount;
    private BigDecimal cancelledAmount;

    /**
     * Refunded orders stay inside GMV - a return happens after the sale was placed, so excluding
     * it would make the monthly series move for orders that were never cancelled. Reported for
     * context only; it is not subtracted from anything.
     */
    private long refundedOrderCount;
    private BigDecimal refundedAmount;

    // ---- Movement against the preceding window -------------------------
    private BigDecimal previousPeriodGmv;
    private long previousPeriodOrderCount;
    /** Null when the previous window had no GMV, since a growth rate off zero base is not a number. */
    private Double gmvGrowthPercent;
    private Double orderGrowthPercent;

    /** Highest-value bucket in the window, or null when nothing traded. */
    private GmvPointDto peakPeriod;

    /**
     * How far through the final bucket the window reaches, 0-100.
     *
     * <p>Reported because it changes how the newest point should be read. On a daily chart today's
     * total sits next to completed days, and drawing them identically makes the most recent bar
     * look like a collapse in trade. A whole-number percentage is more honest than a flag: a
     * series ending "now" is always mid-bucket, so "is it partial?" is always yes and tells a
     * reader nothing about how partial.
     */
    private int lastBucketProgressPercent;

    // ---- Series --------------------------------------------------------
    /**
     * One entry per bucket in the window, in order, including buckets with no trading.
     *
     * <p>Gaps are zero-filled deliberately: a missing bucket in a line chart is drawn as a straight
     * segment across the hole, which reads as continuous activity that never happened.
     */
    private List<GmvPointDto> series;

    private List<FeatureGmvDto> gmvByFeature;

    private List<BreakdownGmvDto> gmvByPaymentMethod;

    private List<CategorySalesDto> categorySales;

    private List<TopProductAnalyticsDto> topProducts;

    private List<CityGmvDto> topCities;

    private List<OrderStatusGmvDto> orderStatusMix;

    // ---- Lifetime, kept separate from the window -----------------------
    private BigDecimal lifetimeGmv;
    private long lifetimeOrderCount;
}
