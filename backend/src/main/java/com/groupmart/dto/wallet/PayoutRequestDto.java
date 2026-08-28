package com.groupmart.dto.wallet;

import jakarta.validation.constraints.DecimalMin;
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
public class PayoutRequestDto {

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "1.00", message = "Minimum payout amount is 1.00")
    private BigDecimal amount;
}

