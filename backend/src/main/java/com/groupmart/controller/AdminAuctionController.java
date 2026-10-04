package com.groupmart.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.auction.AuctionDto;
import com.groupmart.dto.auction.SellerAuctionDto;
import com.groupmart.entity.AuctionStatus;
import com.groupmart.service.AuctionClosingService;
import com.groupmart.service.AuctionService;

import java.util.List;
import java.util.UUID;

/**
 * Admin oversight of eBay-style proxy auctions: read any auction, and withdraw one that breaches
 * the marketplace rules.
 * <p>
 * Admin cancellation goes through {@link AuctionClosingService#cancelByAdmin}, which returns the lot
 * to sellable stock and marks every open bid as lost.
 */
@RestController
@RequestMapping("/api/v1/admin/auctions")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminAuctionController {

    private final AuctionService auctionService;
    private final AuctionClosingService closingService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<SellerAuctionDto>>> getAllAuctions(
            @RequestParam(required = false) AuctionStatus status) {
        return ResponseEntity.ok(ApiResponse.success("Auctions retrieved", auctionService.getAllAuctions(status)));
    }

    @GetMapping("/{auctionId}")
    public ResponseEntity<ApiResponse<SellerAuctionDto>> getAuction(@PathVariable UUID auctionId) {
        return ResponseEntity.ok(ApiResponse.success("Auction retrieved", auctionService.getAuctionAsAdmin(auctionId)));
    }

    @PostMapping("/{auctionId}/force-cancel")
    public ResponseEntity<ApiResponse<AuctionDto>> forceCancel(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID auctionId,
            @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(ApiResponse.success("Auction cancelled",
                closingService.cancelByAdmin(auctionId, userDetails.getUsername(), reason)));
    }

    /** Lets an admin settle a live auction that is already past its deadline. */
    @PostMapping("/{auctionId}/close")
    public ResponseEntity<ApiResponse<AuctionDto>> closeAuction(@PathVariable UUID auctionId) {
        return ResponseEntity.ok(ApiResponse.success("Auction closed", closingService.close(auctionId, null, false)));
    }
}
