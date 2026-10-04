package com.groupmart.dto.auction;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.groupmart.entity.AuctionBidStatus;
import com.groupmart.entity.AuctionStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One row of the customer's "My bids" view: the auction summary beside their own private bid, so
 * the page can be rendered from a single list without a request per auction.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MyBidViewDto {

    private UUID bidId;
    private UUID auctionId;

    private String productName;
    private String productImageUrl;
    private String sellerStoreName;

    private AuctionStatus auctionStatus;
    private AuctionBidStatus bidStatus;

    /** Private: only the owner of this row may see it. */
    private BigDecimal maximumBid;
    private BigDecimal effectiveBid;
    private int quantity;

    private BigDecimal currentPrice;
    private BigDecimal minimumNextBid;
    private BigDecimal finalPrice;
    private boolean hasReserve;
    private boolean reserveMet;

    private boolean winning;
    /** Winning, outbid, won, lost, or closed with no sale - for the page's own filtering. */
    private String outcome;

    private LocalDateTime placedAt;
    private LocalDateTime endsAt;
    private long timeRemainingSeconds;
    private boolean acceptingBids;

    private BigDecimal amountPaid;
    private UUID orderId;
    private String orderNumber;
}
