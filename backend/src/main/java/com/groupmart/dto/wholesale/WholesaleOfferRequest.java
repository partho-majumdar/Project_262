package com.groupmart.dto.wholesale;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.groupmart.entity.WholesaleOfferMode;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WholesaleOfferRequest {

    @NotNull(message = "Product is required")
    private UUID productId;

    @NotNull(message = "Offer mode is required")
    private WholesaleOfferMode mode;

    @NotNull(message = "Wholesale unit price is required")
    @DecimalMin(value = "0.01", message = "Wholesale unit price must be greater than zero")
    private BigDecimal wholesaleUnitPrice;

    @NotNull(message = "Wholesale minimum quantity is required")
    @Min(value = 1, message = "Wholesale minimum quantity must be at least 1")
    private Integer wholesaleMinimumQuantity;

    @NotNull(message = "Maximum available quantity is required")
    @Min(value = 1, message = "Maximum available quantity must be at least 1")
    private Integer maxAvailableQuantity;

    @NotNull(message = "Minimum quantity per customer is required")
    @Min(value = 1, message = "Minimum quantity per customer must be at least 1")
    private Integer minQuantityPerCustomer;

    @NotNull(message = "Maximum quantity per customer is required")
    @Min(value = 1, message = "Maximum quantity per customer must be at least 1")
    private Integer maxQuantityPerCustomer;

    @NotNull(message = "Reservation deadline is required")
    private LocalDateTime reservationDeadline;

    @Size(max = 300, message = "Expected fulfillment note must be at most 300 characters")
    private String expectedFulfillmentNote;

    @Size(max = 1000, message = "Delivery conditions must be at most 1000 characters")
    private String deliveryConditions;

    private boolean autoReopenNewLot;
}
