package com.groupmart.service;

import com.groupmart.dto.auction.AuctionCancelRequest;
import com.groupmart.dto.auction.AuctionCreateRequest;
import com.groupmart.dto.auction.AuctionDto;
import com.groupmart.dto.auction.AuctionUpdateRequest;
import com.groupmart.dto.auction.SellerAuctionDto;
import com.groupmart.entity.AuctionStatus;

import java.util.List;
import java.util.UUID;

/**
 * Seller-side lifecycle and public reads for eBay-style proxy auctions.
 * <p>
 * Independent of {@link WholesalePoolService}: nothing here consults a wholesale minimum, a demand
 * target or a collective quantity.
 */
public interface AuctionService {

    SellerAuctionDto createAuction(String sellerEmail, AuctionCreateRequest request);

    SellerAuctionDto updateAuction(String sellerEmail, UUID auctionId, AuctionUpdateRequest request);

    SellerAuctionDto publishAuction(String sellerEmail, UUID auctionId);

    SellerAuctionDto cancelAuction(String sellerEmail, UUID auctionId, AuctionCancelRequest request);

    List<SellerAuctionDto> getSellerAuctions(String sellerEmail);

    SellerAuctionDto getSellerAuction(String sellerEmail, UUID auctionId);

    /** Admin view of any auction, including one that is not the admin's. */
    SellerAuctionDto getAuctionAsAdmin(UUID auctionId);

    List<SellerAuctionDto> getAllAuctions(AuctionStatus status);

    List<AuctionDto> getMarketplaceAuctions();

    AuctionDto getPublicAuction(UUID auctionId);

    /** Promotes SCHEDULED auctions whose start time has arrived. Safe to run repeatedly. */
    int openDueAuctions();

    /** Closes one auction if it is due. Returns the number actually closed (0 or 1). */
    int closeExpiredAuction(UUID auctionId);
}
