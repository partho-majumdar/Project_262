package com.groupmart.dto.auction;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Partial update of a proxy auction. Every field is optional, so a seller can change one thing
 * without resending the lot.
 * <p>
 * The service refuses price, increment, quantity and schedule changes once the auction is
 * SCHEDULED or LIVE, because a published auction that mutates under its bidders breaks the promise
 * the auction made. Description is the only field still editable while open.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuctionUpdateRequest {

    @Size(max = 2000, message = "Description must be at most 2000 characters")
    private String description;

    @DecimalMin(value = "0.01", message = "Starting price must be positive")
    private BigDecimal startingPrice;

    @DecimalMin(value = "0.01", message = "Minimum bid increment must be positive")
    private BigDecimal minimumBidIncrement;

    @DecimalMin(value = "0.01", message = "Reserve price must be positive")
    private BigDecimal reservePrice;

    @Min(value = 1, message = "Quantity must be at least 1")
    private Integer quantity;

    private LocalDateTime startsAt;

    private LocalDateTime endsAt;
}
