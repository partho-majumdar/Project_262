package com.groupmart.dto.analytics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardAnalyticsDto {

    private BigDecimal totalRevenue;
    private long totalOrders;
    private long totalCustomers;
    private long totalProducts;
    private BigDecimal averageOrderValue;

    private List<RevenueTrendDto> revenueTrends;
    private List<CategorySalesDto> categorySales;
    private List<TopProductAnalyticsDto> topProducts;
}
