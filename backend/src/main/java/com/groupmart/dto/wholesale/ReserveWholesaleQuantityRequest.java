package com.groupmart.dto.wholesale;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

import com.groupmart.entity.PaymentMethod;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReserveWholesaleQuantityRequest {

    @NotNull(message = "Quantity is required")
    @Min(value = 1, message = "Quantity must be at least 1")
    private Integer quantity;

    @NotNull(message = "Shipping address is required")
    private UUID addressId;

    @NotNull(message = "Payment method is required")
    private PaymentMethod paymentMethod;
}
