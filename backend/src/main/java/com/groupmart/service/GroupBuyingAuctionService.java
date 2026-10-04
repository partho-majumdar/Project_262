package com.groupmart.service;

import java.util.List;
import java.util.UUID;

import com.groupmart.dto.auction.AuctionParticipationDto;
import com.groupmart.dto.auction.AuctionResultDto;
import com.groupmart.dto.auction.GroupBuyingAuctionDto;
import com.groupmart.dto.auction.GroupBuyingAuctionRequest;

/**
 * Seller management of Group Buying Auctions plus the public marketplace read model.
 * Independent of the CWP offer service and of the Reverse Group Buying offer service.
 */
public interface GroupBuyingAuctionService {

    // ----- Seller ------------------------------------------------------------------------------

    List<GroupBuyingAuctionDto> getSellerAuctions(String sellerEmail);

    GroupBuyingAuctionDto getSellerAuction(String sellerEmail, UUID auctionId);

    GroupBuyingAuctionDto createAuction(String sellerEmail, GroupBuyingAuctionRequest request);

    GroupBuyingAuctionDto updateAuction(String sellerEmail, UUID auctionId, GroupBuyingAuctionRequest request);

    /** Publishes a draft: it opens immediately, or schedules itself for a future start time. */
    GroupBuyingAuctionDto publishAuction(String sellerEmail, UUID auctionId);

    /** Ends the auction early; every still-open bid is refunded and its quantity released. */
    GroupBuyingAuctionDto cancelAuction(String sellerEmail, UUID auctionId, String reason);

    List<AuctionParticipationDto> getSellerAuctionParticipations(String sellerEmail, UUID auctionId);

    AuctionResultDto getResult(UUID auctionId);

    // ----- Marketplace -------------------------------------------------------------------------

    List<GroupBuyingAuctionDto> getMarketplaceAuctions();

    GroupBuyingAuctionDto getPublicAuction(UUID auctionId);

    // ----- Admin -------------------------------------------------------------------------------

    List<GroupBuyingAuctionDto> getAllAuctions(String status);

    GroupBuyingAuctionDto forceCancelAuction(String adminEmail, UUID auctionId, String reason);

    // ----- Scheduler ----------------------------------------------------------------------------

    /** Opens a published auction whose start time has arrived. */
    void openDueAuction(UUID auctionId);

    /** Finalizes an auction whose end time has passed. No-op if it already ended. */
    void finalizeExpiredAuction(UUID auctionId);
}
