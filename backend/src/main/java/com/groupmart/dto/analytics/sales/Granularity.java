package com.groupmart.dto.analytics.sales;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.IsoFields;
import java.time.temporal.TemporalAdjusters;
import java.util.Locale;

/**
 * How the sales series is divided into buckets, and how wide each bucket is.
 *
 * <p>Monthly buckets hide the shape of a busy fortnight behind one bar, and on a young marketplace
 * they collapse most of the history into a single spike. Day buckets keep the detail; month buckets
 * keep a long view affordable. The bucket limits are per granularity rather than global, because
 * "365 weeks" is a meaningless request and "30 days" is not.
 *
 * <p>Weeks are ISO-8601 and start on Monday, so a bucket never straddles two week numbers.
 */
public enum Granularity {

    DAY(1, 365, "days"),
    WEEK(4, 156, "weeks"),
    MONTH(1, 60, "months");

    private static final DateTimeFormatter DAY_LABEL = DateTimeFormatter.ofPattern("d MMM", Locale.ENGLISH);
    private static final DateTimeFormatter DAY_LABEL_WITH_YEAR = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter MONTH_LABEL = DateTimeFormatter.ofPattern("MMM yyyy", Locale.ENGLISH);

    private final int minBuckets;
    private final int maxBuckets;
    private final String unit;

    Granularity(int minBuckets, int maxBuckets, String unit) {
        this.minBuckets = minBuckets;
        this.maxBuckets = maxBuckets;
        this.unit = unit;
    }

    /** Keeps a request inside the range that makes sense for this bucket width. */
    public int clampBuckets(int requested) {
        return Math.min(Math.max(requested, minBuckets), maxBuckets);
    }

    /** Plural noun for the bucket width, so clients do not each hardcode "days"/"weeks"/"months". */
    public String unit() {
        return unit;
    }

    /** First day of the bucket the given date falls in. */
    public LocalDate bucketStart(LocalDate date) {
        return switch (this) {
            case DAY -> date;
            case WEEK -> date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case MONTH -> date.withDayOfMonth(1);
        };
    }

    /** Moves by whole buckets. Negative counts step back towards older data. */
    public LocalDate shift(LocalDate bucketStart, int buckets) {
        return switch (this) {
            case DAY -> bucketStart.plusDays(buckets);
            case WEEK -> bucketStart.plusWeeks(buckets);
            case MONTH -> bucketStart.plusMonths(buckets);
        };
    }

    /**
     * Sortable bucket key, in a form that orders lexicographically.
     *
     * <p>ISO dates and {@code yyyy-MM} both sort correctly as plain strings. The week key is built
     * by hand rather than formatted, because the calendar year of a late-December week is not the
     * ISO week-based year it belongs to.
     */
    public String key(LocalDate bucketStart) {
        return switch (this) {
            case DAY -> bucketStart.toString();
            case WEEK -> String.format("%04d-W%02d",
                    bucketStart.get(IsoFields.WEEK_BASED_YEAR),
                    bucketStart.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR));
            case MONTH -> String.format("%04d-%02d", bucketStart.getYear(), bucketStart.getMonthValue());
        };
    }

    /**
     * Display label for a bucket.
     *
     * <p>The year is only added when the series crosses a year boundary. Showing "2026" on every
     * point of a 30-day chart costs width and tells the reader nothing, but on a 24-month chart the
     * repeated month names are ambiguous without it.
     */
    public String label(LocalDate bucketStart, boolean includeYear) {
        return switch (this) {
            case DAY -> bucketStart.format(includeYear ? DAY_LABEL_WITH_YEAR : DAY_LABEL);
            case WEEK -> includeYear
                    ? String.format("W%02d '%02d",
                            bucketStart.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR),
                            bucketStart.get(IsoFields.WEEK_BASED_YEAR) % 100)
                    : String.format("W%02d", bucketStart.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR));
            case MONTH -> bucketStart.format(MONTH_LABEL);
        };
    }
}
