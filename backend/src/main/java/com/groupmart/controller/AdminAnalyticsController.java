package com.groupmart.controller;

import java.util.Arrays;
import java.util.Locale;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.analytics.DashboardAnalyticsDto;
import com.groupmart.dto.analytics.sales.Granularity;
import com.groupmart.dto.analytics.sales.MarketplaceSalesPerformanceDto;
import com.groupmart.service.AnalyticsService;
import com.groupmart.service.MarketplaceSalesPerformanceService;

@RestController
@RequestMapping("/api/v1/admin/analytics")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminAnalyticsController {

    private static final int DEFAULT_BUCKETS = 12;
    private static final String GRANULARITY_NAMES = Arrays.stream(Granularity.values())
            .map(Enum::name)
            .collect(Collectors.joining(", "));

    private final AnalyticsService analyticsService;
    private final MarketplaceSalesPerformanceService marketplaceSalesPerformanceService;

    @GetMapping
    public ResponseEntity<ApiResponse<DashboardAnalyticsDto>> getAdminAnalytics() {
        DashboardAnalyticsDto analytics = analyticsService.getAdminDashboardAnalytics();
        return ResponseEntity.ok(ApiResponse.success("Admin dashboard analytics retrieved", analytics));
    }

    /**
     * The GMV surface: a bucketed series plus the breakdowns behind it, over one trailing range.
     *
     * <p>Both parameters arrive as strings and are parsed here rather than bound to an enum or an
     * int. On a secured endpoint this app's security filter turns a Spring conversion failure into
     * a 401, so a caller who mistypes {@code granularity} is told they are not authenticated rather
     * than that their query is wrong. Parsing in the controller keeps the answer a 400, which is
     * what the caller actually did.
     */
    @GetMapping("/sales-performance")
    public ResponseEntity<ApiResponse<MarketplaceSalesPerformanceDto>> getSalesPerformance(
            @RequestParam(name = "granularity", defaultValue = "MONTH") String granularity,
            @RequestParam(name = "buckets", defaultValue = "12") String buckets) {
        MarketplaceSalesPerformanceDto performance = marketplaceSalesPerformanceService
                .getSalesPerformance(parseGranularity(granularity), parseBuckets(buckets));
        return ResponseEntity.ok(ApiResponse.success("Marketplace sales performance retrieved", performance));
    }

    private static Granularity parseGranularity(String value) {
        try {
            return Granularity.valueOf(value.trim().toUpperCase(Locale.ENGLISH));
        } catch (IllegalArgumentException ex) {
            throw new ApiException(
                    "'" + value + "' is not a valid granularity. Expected one of " + GRANULARITY_NAMES + ".",
                    HttpStatus.BAD_REQUEST);
        }
    }

    /** Non-numeric or absent counts fall back to the default; the value is clamped by the granularity. */
    private static int parseBuckets(String value) {
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException ex) {
            return DEFAULT_BUCKETS;
        }
    }
}
