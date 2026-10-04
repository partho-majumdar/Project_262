package com.groupmart.dto.groupr;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** A seller bidding to fulfil a group reverse demand in full. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmitGroupReverseOfferRequest {

    @NotNull(message = "Unit price is required")
    @DecimalMin(value = "0.01", message = "Unit price must be greater than zero")
    private BigDecimal unitPrice;

    @NotNull(message = "Offered quantity is required")
    @Min(value = 1, message = "Offered quantity must be at least 1")
    private Integer offeredQuantity;

    @DecimalMin(value = "0.00", message = "Delivery fee cannot be negative")
    private BigDecimal deliveryFee;

    @NotNull(message = "Estimated delivery days is required")
    @Min(value = 1, message = "Estimated delivery must be at least one day")
    private Integer estimatedDeliveryDays;

    @Min(value = 0, message = "Warranty cannot be negative")
    private Integer warrantyMonths;

    @NotNull(message = "Offer expiry is required")
    @Future(message = "The offer expiry must be in the future")
    private LocalDateTime offerExpiry;

    @Size(max = 1000, message = "Message must be at most 1000 characters")
    private String message;
}
