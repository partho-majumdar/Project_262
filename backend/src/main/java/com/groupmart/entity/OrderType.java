package com.groupmart.entity;

public enum OrderType {
    STANDARD,
    GROUP_BUY,
    WHOLESALE,
    /** Generated when a Reverse Group Buying offer's target condition unlocks its purchasing condition. */
    REVERSE_GROUP_BUYING,
    /** Generated for the winning bids of a finalized Group Buying Auction. */
    GROUP_BUYING_AUCTION,
    /** Generated for the winner of a closed eBay-style proxy-bidding auction. */
    AUCTION,
    /**
     * One member's individual order inside a customer-created group reverse demand, where sellers
     * competed to fulfil the group and the demand creator selected the winning offer.
     */
    GROUP_REVERSE_BUYING
}
