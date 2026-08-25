package com.groupmart.service;

import com.groupmart.dto.analytics.DashboardAnalyticsDto;

public interface AnalyticsService {

    DashboardAnalyticsDto getAdminDashboardAnalytics();

    DashboardAnalyticsDto getSellerDashboardAnalytics(String sellerEmail);
}
