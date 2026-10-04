package com.groupmart.service;

import java.util.UUID;

import com.groupmart.dto.auction.GroupBuyingAuctionDto;

/**
 * The auction mechanism: takes a single, authoritative decision about an auction's outcome.
 * <p>
 * Finalization is server-side and one-shot. The backend locks the auction row, recomputes the
 * clearing price from the auction's own configured pricing rule and the collective quantity actually
 * bid, stores it in an immutable {@code GroupBuyingAuctionResult} and on the auction, and only then
 * creates one individual order per bid at or above that price. Calling it twice is a safe no-op, so
 * a seller action racing the deadline sweep can never finalize an auction twice.
 */
public interface AuctionFinalizationService {

    /**
     * Locks the auction and completes it: COMPLETED with a locked final unit price and generated
     * individual orders, or FAILED with every bid refunded when the minimum collective quantity was
     * not reached.
     *
     * @param actorEmail seller/admin who triggered it, or null for the deadline sweep
     * @param sellerInitiated true when a seller chose to close the auction early
     */
    GroupBuyingAuctionDto finalizeAuction(UUID auctionId, String actorEmail, boolean sellerInitiated);
}
