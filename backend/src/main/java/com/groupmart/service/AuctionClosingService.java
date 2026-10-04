package com.groupmart.service;

import com.groupmart.dto.auction.AuctionDto;

import java.util.UUID;

/**
 * Closes a proxy auction and settles it: declares the winner, creates the winner's order, releases
 * the lot's stock when there is no sale, and tells everybody affected.
 * <p>
 * Idempotent by construction. The auction row is locked and its status checked before anything is
 * written, so running the close repeatedly - the scheduler and a seller pressing the button at the
 * same moment - produces exactly one winner and exactly one order.
 */
public interface AuctionClosingService {

    /**
     * Closes the auction if it is due or the seller asked for an early close.
     *
     * @param actorEmail the seller closing early, or null when the scheduled sweeper calls it
     * @param sellerInitiated true only for an early close requested by the owning seller
     * @return the settled auction, or the already-settled one if this call was a no-op
     */
    AuctionDto close(UUID auctionId, String actorEmail, boolean sellerInitiated);

    /** Withdraws an auction and returns the lot to sellable stock. Seller or admin only. */
    AuctionDto cancelByAdmin(UUID auctionId, String adminEmail, String reason);
}
