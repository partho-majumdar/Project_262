package com.groupmart.dto.auction;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.groupmart.entity.AuctionBidStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * The authenticated bidder's own bid. This is the only place a maximum bid is ever returned, and
 * only ever to the person who set it.
 * <p>
 * Not the same shape as {@link BidHistoryEntryDto}, which anyone may read and which never carries a
 * maximum. Keeping the two apart is what stops a private ceiling leaking into the public API.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MyAuctionBidDto {

    private UUID id;
    private UUID auctionId;
    private String auctionStatus;
    private String productName;
    private String productImageUrl;

    /** Private to this bidder. */
    private BigDecimal maximumBid;

    private BigDecimal effectiveBid;
    private int quantity;
    private AuctionBidStatus status;
    private boolean winning;

    /** What the auction is at right now, and what the bidder would have to authorise next. */
    private BigDecimal currentPrice;
    private BigDecimal minimumNextBid;
    private boolean hasReserve;
    private boolean reserveMet;

    private LocalDateTime placedAt;
    private LocalDateTime auctionEndsAt;
    private long timeRemainingSeconds;

    /** Present only once this bid won. */
    private BigDecimal amountPaid;
    private UUID orderId;
    private String orderNumber;
}
