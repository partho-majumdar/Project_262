package com.groupmart.dto.analytics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FraudAnomalyDto {

    private String orderNumber;
    private String userEmail;
    private BigDecimal amount;
    private int riskScore; // 0 - 100
    private String anomalyReason;
    private String status; // FLAGGED, APPROVED, REVIEW_NEEDED
    private LocalDateTime timestamp;
}
