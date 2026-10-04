package com.groupmart.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.auction.AuctionDto;
import com.groupmart.dto.auction.BidHistoryEntryDto;
import com.groupmart.dto.auction.MyAuctionBidDto;
import com.groupmart.dto.auction.MyBidViewDto;
import com.groupmart.dto.auction.PlaceAuctionBidRequest;
import com.groupmart.service.AuctionBiddingService;
import com.groupmart.service.AuctionService;

import java.util.List;
import java.util.UUID;

/**
 * Customer-facing eBay-style proxy auctions: browsing the marketplace, authorising a maximum bid,
 * watching the public bid history, and one's own bids.
 * <p>
 * The request body carries a private {@code maximumBid} and nothing else. The current price, the
 * leader and the eventual winner are all decided by the server.
 * <p>
 * Separate from {@link GroupBuyingAuctionController}, which prices a collective quantity rather
 * than competing private maxima.
 */
@RestController
@RequestMapping("/api/v1/auctions")
@RequiredArgsConstructor
public class AuctionController {

    private final AuctionService auctionService;
    private final AuctionBiddingService biddingService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<AuctionDto>>> getAuctions() {
        return ResponseEntity.ok(ApiResponse.success("Auctions retrieved", auctionService.getMarketplaceAuctions()));
    }

    @GetMapping("/{auctionId}")
    public ResponseEntity<ApiResponse<AuctionDto>> getAuction(@PathVariable UUID auctionId) {
        return ResponseEntity.ok(ApiResponse.success("Auction retrieved", auctionService.getPublicAuction(auctionId)));
    }

    /** Public history: pseudonymous bidders and the amounts they were committed to. */
    @GetMapping("/{auctionId}/bids")
    public ResponseEntity<ApiResponse<List<BidHistoryEntryDto>>> getBidHistory(@PathVariable UUID auctionId) {
        return ResponseEntity.ok(ApiResponse.success("Bid history retrieved", biddingService.getBidHistory(auctionId)));
    }

    @PostMapping("/{auctionId}/bids")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<MyAuctionBidDto>> placeBid(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID auctionId,
            @Valid @RequestBody PlaceAuctionBidRequest request) {
        MyAuctionBidDto bid = biddingService.placeBid(userDetails.getUsername(), auctionId, request);
        return new ResponseEntity<>(
                ApiResponse.success("Your maximum bid has been accepted", bid, HttpStatus.CREATED.value()),
                HttpStatus.CREATED);
    }

    @GetMapping("/{auctionId}/my-bid")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<MyAuctionBidDto>> getMyBid(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID auctionId) {
        return ResponseEntity.ok(ApiResponse.success("Your bid retrieved",
                biddingService.getMyBid(userDetails.getUsername(), auctionId)));
    }

    @GetMapping("/my-bids")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<MyBidViewDto>>> getMyBids(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success("Your bids retrieved",
                biddingService.getMyBids(userDetails.getUsername())));
    }

    @PostMapping("/bids/{bidId}/withdraw")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<MyAuctionBidDto>> withdrawBid(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID bidId,
            @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(ApiResponse.success("Bid withdrawn",
                biddingService.withdrawBid(userDetails.getUsername(), bidId, reason)));
    }
}
