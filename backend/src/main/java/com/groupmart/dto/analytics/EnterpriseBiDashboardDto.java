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
public class EnterpriseBiDashboardDto {

    private BigDecimal projectedMonthlyRevenue;
    private double forecastGrowthRate;
    private int lowStockAlertCount;
    private int fraudAlertCount;

    private List<AiForecastDto> revenueForecasts;
    private List<LowStockPredictionDto> lowStockPredictions;
    private List<FraudAnomalyDto> fraudAnomalies;
    private List<String> aiBusinessSuggestions;
}
