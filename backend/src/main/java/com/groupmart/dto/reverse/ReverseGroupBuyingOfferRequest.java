package com.groupmart.dto.reverse;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.groupmart.entity.ReverseTargetType;

/** Seller input for creating or editing a Reverse Group Buying offer. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReverseGroupBuyingOfferRequest {

    @NotNull(message = "Product is required")
    private UUID productId;

    @Size(max = 1000, message = "Description must be at most 1000 characters")
    private String description;

    @NotNull(message = "Target type is required")
    private ReverseTargetType targetType;

    /** Required only for DISCOUNT_THRESHOLD: the percentage off the base price. */
    @DecimalMin(value = "0.01", message = "Target value must be greater than zero")
    @DecimalMax(value = "99.99", message = "Target value must be below 100")
    private BigDecimal targetValue;

    @NotNull(message = "Target quantity is required")
    @Min(value = 1, message = "Target quantity must be at least 1")
    private Integer targetQuantity;

    /**
     * The price customers pay per unit once the condition unlocks. Optional for DISCOUNT_THRESHOLD,
     * where it is derived from the target value; required otherwise.
     */
    @DecimalMin(value = "0.01", message = "Unlocked unit price must be greater than zero")
    private BigDecimal unlockedUnitPrice;

    @NotNull(message = "Available quantity is required")
    @Min(value = 1, message = "Available quantity must be at least 1")
    private Integer availableQuantity;

    @NotNull(message = "Minimum quantity per customer is required")
    @Min(value = 1, message = "Minimum quantity per customer must be at least 1")
    private Integer minQuantityPerCustomer;

    @NotNull(message = "Maximum quantity per customer is required")
    @Min(value = 1, message = "Maximum quantity per customer must be at least 1")
    private Integer maxQuantityPerCustomer;

    @NotNull(message = "Participation deadline is required")
    private LocalDateTime participationDeadline;
}
