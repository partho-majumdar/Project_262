package com.groupmart.dto.admin;

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
public class AdminDashboardOverviewDto {

    @Builder.Default
    private long totalUsers = 0;

    @Builder.Default
    private long totalSellers = 0;

    @Builder.Default
    private long totalCategories = 0;

    @Builder.Default
    private long totalProducts = 0;

    @Builder.Default
    private long totalOrders = 0;

    @Builder.Default
    private BigDecimal totalPlatformRevenue = BigDecimal.ZERO;

    @Builder.Default
    private long pendingSellerVerifications = 0;

    private List<AuditLogDto> recentAuditLogs;
}
