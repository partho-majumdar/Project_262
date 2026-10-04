package com.groupmart.dto.analytics.sales;

import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Order state mix, with the value sitting in each state.
 *
 * <p>Cancelled orders are reported here rather than dropped, so the count of every order placed
 * always reconciles against the value that was excluded from GMV.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderStatusGmvDto {

    private String status;

    private String label;

    private long orderCount;

    private BigDecimal amount;
}
