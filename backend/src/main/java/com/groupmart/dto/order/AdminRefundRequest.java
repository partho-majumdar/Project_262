package com.groupmart.dto.order;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/** An administrator's refund on one order. A null amount refunds everything the customer still has paid. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminRefundRequest {

    @DecimalMin(value = "0.01", message = "A refund must be more than zero")
    @Digits(integer = 10, fraction = 2, message = "A refund can have at most 2 decimal places")
    private BigDecimal amount;

    @NotBlank(message = "Give a reason for the refund")
    @Size(max = 300, message = "The reason must be at most 300 characters")
    private String reason;
}
