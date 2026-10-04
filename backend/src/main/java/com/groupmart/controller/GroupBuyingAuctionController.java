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
import com.groupmart.service.AuctionParticipationService;
import com.groupmart.service.GroupBuyingAuctionService;

import java.util.List;
import java.util.UUID;

/**
 * Customer-facing Group Buying Auctions: the dedicated auction marketplace, placing a bid, withdrawing
 * a bid, and one's own bid history.
 * <p>
 * Separate from {@link WholesaleController} (CWP) and {@link ReverseGroupBuyingController}: here the
 * final price is decided by the auction mechanism, not by a wholesale minimum or a demand target.
 */
@RestController
@RequestMapping("/api/v1/group-buying-auctions")
@RequiredArgsConstructor
public class GroupBuyingAuctionController {

    private final GroupBuyingAuctionService auctionService;
    private final AuctionParticipationService participationService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<GroupBuyingAuctionDto>>> getMarketplaceAuctions() {
        return ResponseEntity.ok(ApiResponse.success("Group buying auctions retrieved",
                auctionService.getMarketplaceAuctions()));
    }

    @GetMapping("/{auctionId}")
    public ResponseEntity<ApiResponse<GroupBuyingAuctionDto>> getAuction(@PathVariable UUID auctionId) {
        return ResponseEntity.ok(ApiResponse.success("Group buying auction retrieved",
                auctionService.getPublicAuction(auctionId)));
    }

    @GetMapping("/{auctionId}/result")
    public ResponseEntity<ApiResponse<AuctionResultDto>> getResult(@PathVariable UUID auctionId) {
        return ResponseEntity.ok(ApiResponse.success("Auction result retrieved",
                auctionService.getResult(auctionId)));
    }

    /** Placing a bid is the participation endpoint; {@code maxUnitPrice} is what makes it an auction. */
    @PostMapping("/{auctionId}/participate")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<AuctionParticipationDto>> participate(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID auctionId,
            @Valid @RequestBody AuctionParticipationRequest request) {
        AuctionParticipationDto bid = participationService.placeBid(userDetails.getUsername(), auctionId, request);
        return new ResponseEntity<>(
                ApiResponse.success("Bid placed in the group buying auction", bid, HttpStatus.CREATED.value()),
                HttpStatus.CREATED);
    }

    @PostMapping("/participations/{id}/cancel")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<AuctionParticipationDto>> cancelParticipation(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) AuctionReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Bid withdrawn and refunded",
                participationService.cancelParticipation(userDetails.getUsername(), id,
                        request != null ? request.getReason() : null)));
    }

    @GetMapping("/participations")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<AuctionParticipationDto>>> getMyParticipations(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success("Your auction bids retrieved",
                participationService.getMyParticipations(userDetails.getUsername())));
    }
}
