package com.groupmart.service;

import com.groupmart.dto.analytics.sales.Granularity;
import com.groupmart.dto.analytics.sales.MarketplaceSalesPerformanceDto;

public interface MarketplaceSalesPerformanceService {

    /**
     * Builds the marketplace GMV report as a trailing series ending now.
     *
     * @param granularity bucket width for the series: day, week or month. Day keeps a busy
     *                    fortnight legible; month keeps a long view affordable.
     * @param buckets     how many buckets the series should hold. Clamped to a range that makes
     *                    sense for the granularity, so "365 weeks" is refused rather than served.
     */
    MarketplaceSalesPerformanceDto getSalesPerformance(Granularity granularity, int buckets);
}
