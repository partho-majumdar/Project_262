package com.groupmart.service;

import com.groupmart.dto.auction.AuctionDto;
import com.groupmart.dto.auction.BidHistoryEntryDto;
import com.groupmart.dto.auction.MyAuctionBidDto;
import com.groupmart.dto.auction.MyBidViewDto;
import com.groupmart.dto.auction.SellerAuctionBidDto;
import com.groupmart.dto.auction.PlaceAuctionBidRequest;

import java.util.List;
import java.util.UUID;

/**
 * Customer bidding in an eBay-style proxy auction.
 * <p>
 * A customer submits a private {@code maximumBid}; {@link ProxyBiddingEngine} decides the public
 * price and the leader. The customer can never set a price, name a winner or read anyone else's
 * ceiling.
 * <p>
 * Independent of {@link AuctionParticipationService}, which is the collective-quantity mechanism
 * that clears one price for everybody instead of competing maximum bids.
 */
public interface AuctionBiddingService {

    /**
     * Places a bid or raises an existing one. Both cases are decided by the engine under a
     * pessimistic lock on the auction row.
     */
    MyAuctionBidDto placeBid(String bidderEmail, UUID auctionId, PlaceAuctionBidRequest request);

    MyAuctionBidDto withdrawBid(String bidderEmail, UUID bidId, String reason);

    /** The caller's own bid for one auction, or 404 if they have none. */
    MyAuctionBidDto getMyBid(String bidderEmail, UUID auctionId);

    /** Public history for one auction: pseudonymous aliases and effective amounts only. */
    List<BidHistoryEntryDto> getBidHistory(UUID auctionId);

    /** Every bid the caller has made, newest first, with the auction summary attached. */
    List<MyBidViewDto> getMyBids(String bidderEmail);

    /** Seller view of the bids on their own auction: aliases and amounts, never maximums. */
    List<BidHistoryEntryDto> getBidHistoryForSeller(String sellerEmail, UUID auctionId);

    /**
     * The privileged seller view: the real bidder, the committed amount, the ceiling behind it and
     * whether it leads. Scoped to the caller's own auction, and never reachable from a public route.
     */
    List<SellerAuctionBidDto> getSellerBids(String sellerEmail, UUID auctionId);
}
