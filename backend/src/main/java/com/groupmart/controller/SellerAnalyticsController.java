package com.groupmart.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.analytics.DashboardAnalyticsDto;
import com.groupmart.service.AnalyticsService;

@RestController
@RequestMapping("/api/v1/seller/analytics")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SELLER', 'ADMIN')")
public class SellerAnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping
    public ResponseEntity<ApiResponse<DashboardAnalyticsDto>> getSellerAnalytics(@AuthenticationPrincipal UserDetails userDetails) {
        DashboardAnalyticsDto analytics = analyticsService.getSellerDashboardAnalytics(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Seller store analytics retrieved", analytics));
    }
}
