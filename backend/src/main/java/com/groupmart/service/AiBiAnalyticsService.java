package com.groupmart.service;

import com.groupmart.dto.analytics.EnterpriseBiDashboardDto;

public interface AiBiAnalyticsService {

    EnterpriseBiDashboardDto getEnterpriseBiDashboard();

    String generateCsvReport();
}
