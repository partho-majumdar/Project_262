package com.groupmart.entity;

/** Status of one customer's independent bid in a Group Buying Auction. */
public enum AuctionParticipationStatus {
    BID_PLACED, // Active bid still counted in the collective quantity
    WON,        // Final price was at or below this bid's maximum; an individual order was created
    OUTBID,     // The auction's locked final price was above this bid's maximum; bid not honoured
    CANCELLED,  // Withdrawn by the customer before finalization
    REFUNDED    // The auction failed or was cancelled; bid not honoured
}
