package com.groupmart.dto.analytics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiForecastDto {

    private String dateLabel;
    private BigDecimal predictedRevenue;
    private long predictedOrderCount;
    private double confidencePercentage;
}
