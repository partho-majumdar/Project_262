package com.groupmart.dto.auction;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.groupmart.entity.PaymentMethod;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * A customer authorises a ceiling; the server decides the public price.
 * <p>
 * The client sends {@code maximumBid} and nothing else about the outcome. It cannot propose a
 * current price, a leader or a winner, and the engine ignores any such claim.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlaceAuctionBidRequest {

    @NotNull(message = "A maximum bid is required")
    @DecimalMin(value = "0.01", message = "Your maximum bid must be positive")
    private BigDecimal maximumBid;

    @Min(value = 1, message = "Quantity must be at least 1")
    private Integer quantity;

    @NotNull(message = "Shipping address is required")
    private UUID addressId;

    @NotNull(message = "Payment method is required")
    private PaymentMethod paymentMethod;
}
