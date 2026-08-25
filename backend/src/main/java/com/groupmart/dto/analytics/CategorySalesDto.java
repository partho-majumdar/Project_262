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
public class CategorySalesDto {

    private String categoryName;
    private long salesCount;
    private BigDecimal totalRevenue;
    private double percentage;
}
