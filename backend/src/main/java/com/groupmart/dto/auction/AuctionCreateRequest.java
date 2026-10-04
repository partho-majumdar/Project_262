package com.groupmart.dto.auction;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** Seller request to open a new proxy auction on one of their own products. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuctionCreateRequest {

    @NotNull(message = "Product is required")
    private UUID productId;

    @Size(max = 2000, message = "Description must be at most 2000 characters")
    private String description;

    @NotNull(message = "Starting price is required")
    @DecimalMin(value = "0.01", message = "Starting price must be positive")
    private BigDecimal startingPrice;

    @NotNull(message = "Minimum bid increment is required")
    @DecimalMin(value = "0.01", message = "Minimum bid increment must be positive")
    private BigDecimal minimumBidIncrement;

    /** Optional and private: bidders only ever see whether it is set and whether it is met. */
    @DecimalMin(value = "0.01", message = "Reserve price must be positive")
    private BigDecimal reservePrice;

    @NotNull(message = "Quantity is required")
    @Min(value = 1, message = "Quantity must be at least 1")
    private Integer quantity;

    @NotNull(message = "Start time is required")
    private LocalDateTime startsAt;

    @NotNull(message = "End time is required")
    private LocalDateTime endsAt;
}
