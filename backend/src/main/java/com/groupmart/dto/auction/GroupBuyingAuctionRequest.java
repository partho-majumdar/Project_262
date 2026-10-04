package com.groupmart.dto.auction;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.groupmart.entity.AuctionPricingRule;

/** Seller input for creating or editing a Group Buying Auction, including its pricing rule. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuyingAuctionRequest {

    @NotNull(message = "Product is required")
    private UUID productId;

    @Size(max = 1000, message = "Description must be at most 1000 characters")
    private String description;

    @NotNull(message = "Starting price is required")
    @DecimalMin(value = "0.01", message = "Starting price must be greater than zero")
    private BigDecimal startingPrice;

    /** Optional seller floor; the final price is never pushed below it. */
    @DecimalMin(value = "0.01", message = "Minimum seller unit price must be greater than zero")
    private BigDecimal minimumSellerUnitPrice;

    @NotNull(message = "Available quantity is required")
    @Min(value = 1, message = "Available quantity must be at least 1")
    private Integer availableQuantity;

    @NotNull(message = "Minimum collective quantity is required")
    @Min(value = 1, message = "Minimum collective quantity must be at least 1")
    private Integer minimumCollectiveQuantity;

    @NotNull(message = "Minimum quantity per customer is required")
    @Min(value = 1, message = "Minimum quantity per customer must be at least 1")
    private Integer minQuantityPerCustomer;

    @NotNull(message = "Maximum quantity per customer is required")
    @Min(value = 1, message = "Maximum quantity per customer must be at least 1")
    private Integer maxQuantityPerCustomer;

    @NotNull(message = "Auction start time is required")
    private LocalDateTime startsAt;

    @NotNull(message = "Auction end time is required")
    private LocalDateTime endsAt;

    @NotNull(message = "Pricing rule is required")
    private AuctionPricingRule pricingRule;

    /** Required for COLLECTIVE_QUANTITY_DISCOUNT: the percentage off the starting price. */
    @DecimalMin(value = "0.01", message = "Discount percent must be greater than zero")
    @DecimalMax(value = "99.99", message = "Discount percent must be below 100")
    private BigDecimal discountPercent;

    /** Required for COLLECTIVE_QUANTITY_TIERS: the seller's collective quantity ladder. */
    @Valid
    private List<GroupBuyingAuctionTierRequest> tiers;
}
