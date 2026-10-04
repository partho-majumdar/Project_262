package com.groupmart.service;

import java.util.List;
import java.util.UUID;

import com.groupmart.dto.auction.AuctionParticipationDto;
import com.groupmart.dto.auction.AuctionParticipationRequest;

/**
 * Customer side of a Group Buying Auction: placing a bid (quantity plus the maximum unit price they
 * will accept), withdrawing a bid before the auction ends, and reviewing one's own bids.
 */
public interface AuctionParticipationService {

    AuctionParticipationDto placeBid(String userEmail, UUID auctionId, AuctionParticipationRequest request);

    /** Withdraws a bid while the auction is still running. */
    AuctionParticipationDto cancelParticipation(String userEmail, UUID participationId, String reason);

    List<AuctionParticipationDto> getMyParticipations(String userEmail);
}
