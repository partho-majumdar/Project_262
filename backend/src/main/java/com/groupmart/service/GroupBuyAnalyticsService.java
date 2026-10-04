package com.groupmart.service;

import com.groupmart.dto.groupbuy.analytics.GroupBuyAnalyticsDto;

/** Group buy analytics and reporting for administrators (whole platform) and sellers (their own store). */
public interface GroupBuyAnalyticsService {

    /** {@code days <= 0} means all time. */
    GroupBuyAnalyticsDto getPlatformAnalytics(int days);

    GroupBuyAnalyticsDto getSellerAnalytics(String sellerEmail, int days);
}
