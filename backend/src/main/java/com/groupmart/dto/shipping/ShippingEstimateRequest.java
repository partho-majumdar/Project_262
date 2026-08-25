package com.groupmart.dto.shipping;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShippingEstimateRequest {

    private UUID addressId;

    @NotNull(message = "Subtotal amount is required")
    private BigDecimal subtotal;
}
