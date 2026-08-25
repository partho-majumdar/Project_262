package com.groupmart.dto.seller;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SellerDashboardOverviewDto {

    private SellerStoreDto store;
    
    @Builder.Default
    private BigDecimal totalRevenue = BigDecimal.ZERO;
    
    @Builder.Default
    private long totalOrders = 0;
    
    @Builder.Default
    private long totalProducts = 0;
    
    @Builder.Default
    private long lowStockAlertCount = 0;
    
    @Builder.Default
    private double averageRating = 0.0;
}
