package com.groupmart.dto.auction;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * One row of the public bid history.
 * <p>
 * {@code amount} is the effective bid - the figure the engine committed the customer to at that
 * moment - and never their maximum. {@code bidderAlias} is a stable pseudonym rather than a name,
 * email or user id, so the history is useful without identifying anybody.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BidHistoryEntryDto {

    private Long sequence;
    private String bidderAlias;
    /** The committed amount for this bid at the time it was placed, not the private ceiling. */
    private BigDecimal amount;
    private int quantity;
    private LocalDateTime placedAt;
    /** True for the bid the engine currently backs. */
    private boolean leading;
}
