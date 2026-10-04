package com.groupmart.entity;

/**
 * Lifecycle of an eBay-style proxy-bidding auction.
 * <p>
 * Separate from {@link GroupBuyingAuctionStatus}: that mechanism prices a collective quantity, this
 * one prices a single lot against competing private maximum bids.
 * <p>
 * {@link #ENDED} is the terminal state for "closed with no sale and no reserve to fail" (nobody
 * bid). When a reserve price is configured and bids exist but fall short, the terminal state is
 * {@link #RESERVE_NOT_MET} instead. Both are reached from the same close operation, so a single
 * run of the closing process leaves exactly one terminal state behind.
 */
public enum AuctionStatus {
    /** Created but not published. Bids are rejected and nothing is visible in the marketplace. */
    DRAFT,
    /** Published, waiting for {@code startsAt}. */
    SCHEDULED,
    /** Open for bidding. */
    LIVE,
    /** Closed, no bids, therefore no sale. */
    ENDED,
    /** Closed with a winner; the winning bid became an order. */
    SOLD,
    /** Closed, bids existed, but the highest maximum bid never reached the reserve price. */
    RESERVE_NOT_MET,
    /** Withdrawn by the seller or an admin before a winner existed. */
    CANCELLED;

    public boolean isTerminal() {
        return this == ENDED || this == SOLD || this == RESERVE_NOT_MET || this == CANCELLED;
    }

    public boolean acceptsBids() {
        return this == LIVE;
    }

    /** Bids are frozen but the outcome is not final yet. */
    public boolean isClosing() {
        return this == ENDED || this == RESERVE_NOT_MET || this == SOLD;
    }
}
