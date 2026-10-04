package com.groupmart.entity;

/**
 * The configured collective pricing rule of an auction. The rule is stored on the auction and
 * evaluated by {@code AuctionPricingService} - the final price is never hardcoded at a call site.
 */
public enum AuctionPricingRule {
    /**
     * Explicit quantity tiers: the highest tier whose minimum collective quantity is met wins,
     * e.g. 1-4 units = 1000, 5-9 = 950, 10+ = 900. Requires {@code GroupBuyingAuctionTier} rows.
     */
    COLLECTIVE_QUANTITY_TIERS,
    /**
     * A single percentage off the starting price, applied when the minimum collective quantity is
     * met: final = startingPrice * (1 - discountPercent / 100).
     */
    COLLECTIVE_QUANTITY_DISCOUNT
}
