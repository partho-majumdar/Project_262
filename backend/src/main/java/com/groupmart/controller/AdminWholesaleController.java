package com.groupmart.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.wholesale.WholesaleDisputeDecisionRequest;
import com.groupmart.dto.wholesale.WholesaleDisputeDto;
import com.groupmart.dto.wholesale.WholesaleOfferDto;
import com.groupmart.dto.wholesale.WholesaleReasonRequest;
import com.groupmart.service.WholesaleDisputeService;
import com.groupmart.service.WholesaleOfferService;

import java.util.List;
import java.util.UUID;

/** Admin moderation of Collaborative Wholesale Purchasing offers. */
@RestController
@RequestMapping("/api/v1/admin/wholesale")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminWholesaleController {

    private final WholesaleOfferService offerService;
    private final WholesaleDisputeService disputeService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<WholesaleOfferDto>>> getOffers(
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success("Wholesale offers retrieved",
                offerService.getAllOffers(status)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<WholesaleOfferDto>> getOffer(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Wholesale offer retrieved",
                offerService.getOfferForAdmin(id)));
    }

    @PostMapping("/{id}/force-close")
    public ResponseEntity<ApiResponse<WholesaleOfferDto>> forceClose(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) WholesaleReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Wholesale offer closed",
                offerService.forceCloseOffer(userDetails.getUsername(), id, reason(request))));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<WholesaleOfferDto>> cancel(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) WholesaleReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Wholesale offer cancelled",
                offerService.adminCancelOffer(userDetails.getUsername(), id, reason(request))));
    }

    // ----- Disputes ------------------------------------------------------------------------------

    @GetMapping("/disputes")
    public ResponseEntity<ApiResponse<List<WholesaleDisputeDto>>> getDisputes(
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success("Wholesale disputes retrieved",
                disputeService.getDisputes(status)));
    }

    @GetMapping("/disputes/{id}")
    public ResponseEntity<ApiResponse<WholesaleDisputeDto>> getDispute(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Wholesale dispute retrieved", disputeService.getDispute(id)));
    }

    @PostMapping("/disputes/{id}/review")
    public ResponseEntity<ApiResponse<WholesaleDisputeDto>> startReview(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) WholesaleReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Dispute moved to review",
                disputeService.startReview(userDetails.getUsername(), id, reason(request))));
    }

    @PostMapping("/disputes/{id}/resolve")
    public ResponseEntity<ApiResponse<WholesaleDisputeDto>> resolveDispute(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody WholesaleDisputeDecisionRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Dispute resolved",
                disputeService.resolve(userDetails.getUsername(), id, request.getRefundAmount(), request.getNote())));
    }

    @PostMapping("/disputes/{id}/reject")
    public ResponseEntity<ApiResponse<WholesaleDisputeDto>> rejectDispute(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody WholesaleDisputeDecisionRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Dispute rejected",
                disputeService.reject(userDetails.getUsername(), id, request.getNote())));
    }

    private static String reason(WholesaleReasonRequest request) {
        return request != null ? request.getReason() : null;
    }
}
