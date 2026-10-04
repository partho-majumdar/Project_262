package com.groupmart.dto.auction;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

import com.groupmart.entity.PaymentMethod;

/** Customer bid: how many units, and the maximum unit price they will accept for them. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuctionParticipationRequest {

    @NotNull(message = "Quantity is required")
    @Min(value = 1, message = "Quantity must be at least 1")
    private Integer quantity;

    @NotNull(message = "Maximum unit price is required")
    @DecimalMin(value = "0.01", message = "Maximum unit price must be greater than zero")
    private BigDecimal maxUnitPrice;

    @NotNull(message = "Shipping address is required")
    private UUID addressId;

    @NotNull(message = "Payment method is required")
    private PaymentMethod paymentMethod;
}
