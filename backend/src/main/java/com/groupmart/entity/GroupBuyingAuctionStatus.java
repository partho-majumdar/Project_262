package com.groupmart.entity;

/**
 * Lifecycle of a Group Buying Auction.
 * <p>
 * A Group Buying Auction is a third, independent purchasing mechanism: customers place bids
 * (quantity + maximum unit price they will accept), the auction mechanism evaluates the collective
 * participation once and locks a single final unit price, and only the bids at or above that
 * clearing price are honoured with their own individual order.
 * <p>
 * It shares no logic with Collaborative Wholesale Purchasing (no pool, no reservations, no wholesale
 * minimum) and none with Reverse Group Buying (no seller-defined demand target to unlock).
 */
public enum GroupBuyingAuctionStatus {
    DRAFT,      // Configured by the seller, not published
    SCHEDULED,  // Published with a future start time; opens automatically
    OPEN,       // Accepting bids
    COMPLETED,  // Finalized: the result and its final unit price are locked, orders exist
    FAILED,     // Ended without reaching the minimum collective quantity; every bid refunded
    CANCELLED;  // Seller cancelled the auction before it ended

    public boolean isTerminal() {
        return this == COMPLETED || this == FAILED || this == CANCELLED;
    }

    public boolean acceptsBids() {
        return this == OPEN;
    }
}
