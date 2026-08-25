package com.groupmart.dto.analytics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LowStockPredictionDto {

    private UUID productId;
    private String productName;
    private String sku;
    private int currentStock;
    private int estimatedBurnRatePerDay;
    private int daysUntilStockout;
    private String riskLevel; // CRITICAL, WARNING, NORMAL
}
