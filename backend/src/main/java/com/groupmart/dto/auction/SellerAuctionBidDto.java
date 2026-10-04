package com.groupmart.dto.auction;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One bid as the <b>owning seller</b> sees it.
 * <p>
 * This is the privileged counterpart of {@link BidHistoryEntryDto}, which stays pseudonymous
 * because anybody may read it. A seller needs the two things a public viewer may not have: who is
 * bidding, and where each individual bid currently stands. The reserve price and the winner's
 * identity already live on the seller side of the feature, so a seller who may read those may read
 * this too.
 * <p>
 * {@code maximumBid} is included deliberately: a seller running an auction needs the standing
 * ceiling to know whether a bidder can still be pushed, and the value is exposed only through
 * endpoints that re-check that the caller owns the auction. No public DTO carries this field.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SellerAuctionBidDto {

    private UUID bidId;
    /** Real identity, which the public ladder deliberately withholds. */
    private String bidderName;
    private String bidderEmail;
    /** The same stable pseudonym the public ladder shows, so rows can be matched across views. */
    private String bidderAlias;

    /** What this bid is publicly committed to right now. */
    private BigDecimal amount;
    /** The private ceiling behind the bid. Seller-only. */
    private BigDecimal maximumBid;
    private int quantity;
    /** ACTIVE, WINNING, OUTBID, WON, LOST or CANCELLED, as a name. */
    private String status;
    /** True for the bid the engine currently backs. */
    private boolean leading;
    private LocalDateTime placedAt;
    private LocalDateTime updatedAt;
    /** True once the customer raised their ceiling on this bid rather than placing it once. */
    private boolean revised;
    private BigDecimal amountPaid;
    private String orderNumber;
    private String cancellationReason;
}
