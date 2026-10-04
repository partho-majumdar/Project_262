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
import com.groupmart.service.AuctionFinalizationService;
import com.groupmart.service.GroupBuyingAuctionService;

import java.util.List;
import java.util.UUID;

/**
 * Seller management of Group Buying Auctions: configure the auction mechanism and its pricing rule,
 * publish it, watch the collective bidding, and finalize it. Separate from
 * {@link SellerWholesaleController} (CWP), which is left untouched.
 */
@RestController
@RequestMapping("/api/v1/seller/group-buying-auctions")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SELLER', 'ADMIN')")
public class SellerGroupBuyingAuctionController {

    private final GroupBuyingAuctionService auctionService;
    private final AuctionFinalizationService finalizationService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<GroupBuyingAuctionDto>>> getAuctions(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success("Group buying auctions retrieved",
                auctionService.getSellerAuctions(userDetails.getUsername())));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<GroupBuyingAuctionDto>> getAuction(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Group buying auction retrieved",
                auctionService.getSellerAuction(userDetails.getUsername(), id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<GroupBuyingAuctionDto>> createAuction(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody GroupBuyingAuctionRequest request) {
        GroupBuyingAuctionDto created = auctionService.createAuction(userDetails.getUsername(), request);
        return new ResponseEntity<>(
                ApiResponse.success("Group buying auction saved as draft", created, HttpStatus.CREATED.value()),
                HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<GroupBuyingAuctionDto>> updateAuction(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody GroupBuyingAuctionRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Group buying auction updated",
                auctionService.updateAuction(userDetails.getUsername(), id, request)));
    }

    @PostMapping("/{id}/publish")
    public ResponseEntity<ApiResponse<GroupBuyingAuctionDto>> publish(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Auction published",
                auctionService.publishAuction(userDetails.getUsername(), id)));
    }

    @PostMapping("/{id}/finalize")
    public ResponseEntity<ApiResponse<GroupBuyingAuctionDto>> finalizeAuction(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Auction finalized",
                finalizationService.finalizeAuction(id, userDetails.getUsername(), true)));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<GroupBuyingAuctionDto>> cancel(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) AuctionReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Auction ended",
                auctionService.cancelAuction(userDetails.getUsername(), id,
                        request != null ? request.getReason() : null)));
    }

    @GetMapping("/{id}/participations")
    public ResponseEntity<ApiResponse<List<AuctionParticipationDto>>> getParticipations(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Auction bids retrieved",
                auctionService.getSellerAuctionParticipations(userDetails.getUsername(), id)));
    }

    @GetMapping("/{id}/result")
    public ResponseEntity<ApiResponse<AuctionResultDto>> getResult(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Auction result retrieved", auctionService.getResult(id)));
    }
}
