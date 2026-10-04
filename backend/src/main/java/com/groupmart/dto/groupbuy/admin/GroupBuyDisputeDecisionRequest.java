package com.groupmart.dto.groupbuy.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuyDisputeDecisionRequest {

    @Size(max = 1000, message = "Note must be at most 1000 characters")
    private String note;

    @DecimalMin(value = "0.00", message = "Refund amount cannot be negative")
    private BigDecimal refundAmount;
}
