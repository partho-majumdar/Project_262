package com.groupmart.entity;

/**
 * State of one customer's proxy bid.
 * <p>
 * A bidder has at most one bid per auction, so {@link #WINNING} and {@link #OUTBID} simply describe
 * where that single bid currently sits in the ranking.
 */
public enum AuctionBidStatus {
    /** Submitted and still eligible to win. */
    ACTIVE,
    /** Currently the highest bid, i.e. the customer is winning right now. */
    WINNING,
    /** Eligible but somebody else is ahead. */
    OUTBID,
    /** Won the auction; an order was created for it. */
    WON,
    /** The auction closed and this bid did not win. */
    LOST,
    /** Withdrawn by the customer while the auction was still open. */
    CANCELLED;

    public boolean isEligible() {
        return this == ACTIVE || this == WINNING || this == OUTBID;
    }
}
