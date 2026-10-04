package com.groupmart.dto.auction;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/** One rung of an auction's collective-quantity price ladder. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuyingAuctionTierRequest {

    @Min(value = 1, message = "Tier minimum quantity must be at least 1")
    private Integer minQuantity;

    @DecimalMin(value = "0.01", message = "Tier unit price must be greater than zero")
    private BigDecimal unitPrice;
}
