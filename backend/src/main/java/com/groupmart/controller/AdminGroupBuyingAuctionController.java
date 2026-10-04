package com.groupmart.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.auction.AuctionReasonRequest;
import com.groupmart.dto.auction.AuctionResultDto;
import com.groupmart.dto.auction.GroupBuyingAuctionDto;
import com.groupmart.service.GroupBuyingAuctionService;

import java.util.List;
import java.util.UUID;

/**
 * Administrative oversight of Group Buying Auctions: read every seller's auctions, read a finalized
 * result, and end an auction that has to be stopped. Ending one always goes through the same
 * one-shot finalization path as a normal close, so an auction can never be resolved twice.
 */
@RestController
@RequestMapping("/api/v1/admin/group-buying-auctions")
@RequiredArgsConstructor
public class AdminGroupBuyingAuctionController {

    private final GroupBuyingAuctionService auctionService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<GroupBuyingAuctionDto>>> getAuctions(
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success("Group buying auctions retrieved",
                auctionService.getAllAuctions(status)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<GroupBuyingAuctionDto>> getAuction(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Group buying auction retrieved",
                auctionService.getPublicAuction(id)));
    }

    @GetMapping("/{id}/result")
    public ResponseEntity<ApiResponse<AuctionResultDto>> getResult(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Auction result retrieved", auctionService.getResult(id)));
    }

    @PostMapping("/{id}/force-cancel")
    public ResponseEntity<ApiResponse<GroupBuyingAuctionDto>> forceCancel(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) AuctionReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Auction ended and bids resolved",
                auctionService.forceCancelAuction(null, id, request != null ? request.getReason() : null)));
    }
}
