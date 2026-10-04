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
import com.groupmart.dto.auction.*;
import com.groupmart.service.AuctionBiddingService;
import com.groupmart.service.AuctionClosingService;
import com.groupmart.service.AuctionService;

import java.util.List;
import java.util.UUID;

/**
 * Seller management of their own eBay-style proxy auctions: DRAFT → SCHEDULED/LIVE → closed.
 * <p>
 * The paths sit under {@code /api/v1/seller/**}, which the security configuration already restricts
 * to SELLER and ADMIN, and every operation additionally re-checks that the auction belongs to the
 * caller in the service.
 */
@RestController
@RequestMapping("/api/v1/seller/auctions")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SELLER', 'ADMIN')")
public class SellerAuctionController {

    private final AuctionService auctionService;
    private final AuctionBiddingService biddingService;
    private final AuctionClosingService closingService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<SellerAuctionDto>>> getMyAuctions(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success("Your auctions retrieved",
                auctionService.getSellerAuctions(userDetails.getUsername())));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<SellerAuctionDto>> createAuction(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody AuctionCreateRequest request) {
        SellerAuctionDto auction = auctionService.createAuction(userDetails.getUsername(), request);
        return new ResponseEntity<>(
                ApiResponse.success("Auction created as a draft", auction, HttpStatus.CREATED.value()),
                HttpStatus.CREATED);
    }

    @GetMapping("/{auctionId}")
    public ResponseEntity<ApiResponse<SellerAuctionDto>> getAuction(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID auctionId) {
        return ResponseEntity.ok(ApiResponse.success("Auction retrieved",
                auctionService.getSellerAuction(userDetails.getUsername(), auctionId)));
    }

    @PutMapping("/{auctionId}")
    public ResponseEntity<ApiResponse<SellerAuctionDto>> updateAuction(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID auctionId,
            @Valid @RequestBody AuctionUpdateRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Auction updated",
                auctionService.updateAuction(userDetails.getUsername(), auctionId, request)));
    }

    @PostMapping("/{auctionId}/publish")
    public ResponseEntity<ApiResponse<SellerAuctionDto>> publishAuction(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID auctionId) {
        return ResponseEntity.ok(ApiResponse.success("Auction published",
                auctionService.publishAuction(userDetails.getUsername(), auctionId)));
    }

    /** Ends a live auction early. The same close the scheduler would run, so it stays idempotent. */
    @PostMapping("/{auctionId}/close")
    public ResponseEntity<ApiResponse<AuctionDto>> closeAuction(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID auctionId) {
        return ResponseEntity.ok(ApiResponse.success("Auction closed",
                closingService.close(auctionId, userDetails.getUsername(), true)));
    }

    @PostMapping("/{auctionId}/cancel")
    public ResponseEntity<ApiResponse<SellerAuctionDto>> cancelAuction(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID auctionId,
            @Valid @RequestBody(required = false) AuctionCancelRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Auction cancelled",
                auctionService.cancelAuction(userDetails.getUsername(), auctionId, request)));
    }

    /**
     * The privileged bid list: the real bidder, the amount each bid is committed to, the ceiling
     * behind it and whether it currently leads.
     * <p>
     * This is what lets a seller see who bid and watch the price move while the auction runs, which
     * the anonymous public ladder cannot show them. The service re-checks that the auction belongs
     * to the caller, and no public route exposes a maximum bid.
     */
    @GetMapping("/{auctionId}/bids/detailed")
    public ResponseEntity<ApiResponse<List<SellerAuctionBidDto>>> getDetailedBids(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID auctionId) {
        return ResponseEntity.ok(ApiResponse.success("Bids retrieved",
                biddingService.getSellerBids(userDetails.getUsername(), auctionId)));
    }

    /** Pseudonymous aliases and effective amounts; kept for callers that only need the ladder. */
    @GetMapping("/{auctionId}/bids")
    public ResponseEntity<ApiResponse<List<BidHistoryEntryDto>>> getBids(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID auctionId) {
        return ResponseEntity.ok(ApiResponse.success("Bids retrieved",
                biddingService.getBidHistoryForSeller(userDetails.getUsername(), auctionId)));
    }
}
