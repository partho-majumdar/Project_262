package com.groupmart.dto.groupbuy;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

/** Seller's own cost per unit for profit analytics. A null cost clears it. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuyUnitCostRequest {

    private UUID campaignId;

    @DecimalMin(value = "0.00", message = "Unit cost cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Unit cost can have at most 2 decimal places")
    private BigDecimal unitCost;
}
