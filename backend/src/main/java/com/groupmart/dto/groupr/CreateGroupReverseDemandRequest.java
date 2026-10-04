package com.groupmart.dto.groupr;

import java.math.BigDecimal;
import java.time.LocalDate;
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

/**
 * A customer's request for other customers to join them in demanding a product at a given price.
 * <p>
 * The creator becomes {@code GROUP_LEADER}: they set the terms here and hold the sole right to pick
 * a seller later, but they are not treated as the buyer for anyone else's quantity.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateGroupReverseDemandRequest {

    @NotNull(message = "Product is required")
    private UUID productId;

    @Size(max = 2000, message = "Description must be at most 2000 characters")
    private String description;

    @NotNull(message = "Required quantity is required")
    @Min(value = 2, message = "Required quantity must be at least 2 (a group needs more than one buyer)")
    private Integer requiredQuantity;

    @NotNull(message = "Target price is required")
    @DecimalMin(value = "0.01", message = "Target price must be greater than zero")
    private BigDecimal targetPrice;

    @DecimalMin(value = "0.01", message = "Maximum price must be greater than zero")
    private BigDecimal maxPrice;

    @NotNull(message = "Minimum member quantity is required")
    @Min(value = 1, message = "Minimum member quantity must be at least 1")
    private Integer minQuantityPerMember;

    @NotNull(message = "Maximum member quantity is required")
    @Min(value = 1, message = "Maximum member quantity must be at least 1")
    private Integer maxQuantityPerMember;

    @NotNull(message = "Join deadline is required")
    @Future(message = "The join deadline must be in the future")
    private LocalDateTime joinDeadline;

    @NotNull(message = "Offer deadline is required")
    @Future(message = "The offer deadline must be in the future")
    private LocalDateTime offerDeadline;

    @Size(max = 100, message = "Delivery city must be at most 100 characters")
    private String deliveryCity;

    private LocalDate requiredDeliveryDate;
}
