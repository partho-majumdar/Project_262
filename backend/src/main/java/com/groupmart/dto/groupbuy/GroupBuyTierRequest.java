package com.groupmart.dto.groupbuy;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuyTierRequest {

    @NotNull(message = "Tier participant count is required")
    @Min(value = 2, message = "A price tier needs at least 2 participants")
    private Integer minParticipants;

    @NotNull(message = "Tier price is required")
    @DecimalMin(value = "0.01", message = "Tier price must be greater than zero")
    private BigDecimal unitPrice;
}
