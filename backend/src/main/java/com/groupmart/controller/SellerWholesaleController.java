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
import com.groupmart.dto.order.OrderDto;
import com.groupmart.dto.wholesale.WholesaleOfferDto;
import com.groupmart.dto.wholesale.WholesaleOfferRequest;
import com.groupmart.dto.wholesale.WholesalePoolDto;
import com.groupmart.dto.wholesale.WholesaleReasonRequest;
import com.groupmart.service.WholesaleOfferService;
import com.groupmart.service.WholesalePoolService;

import java.util.List;
import java.util.UUID;

/** Seller management of Collaborative Wholesale Purchasing offers (CWP spec sections 3 and 20). */
@RestController
@RequestMapping("/api/v1/seller/wholesale")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SELLER', 'ADMIN')")
public class SellerWholesaleController {

    private final WholesaleOfferService offerService;
    private final WholesalePoolService poolService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<WholesaleOfferDto>>> getOffers(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success("Wholesale offers retrieved",
                offerService.getSellerOffers(userDetails.getUsername())));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<WholesaleOfferDto>> getOffer(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Wholesale offer retrieved",
                offerService.getSellerOffer(userDetails.getUsername(), id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<WholesaleOfferDto>> createOffer(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody WholesaleOfferRequest request) {
        WholesaleOfferDto created = offerService.createOffer(userDetails.getUsername(), request);
        return new ResponseEntity<>(
                ApiResponse.success("Wholesale offer saved as draft", created, HttpStatus.CREATED.value()),
                HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<WholesaleOfferDto>> updateOffer(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody WholesaleOfferRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Wholesale offer updated",
                offerService.updateOffer(userDetails.getUsername(), id, request)));
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<ApiResponse<WholesaleOfferDto>> activate(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Wholesale offer is now live",
                offerService.activateOffer(userDetails.getUsername(), id)));
    }

    @PostMapping("/{id}/pause")
    public ResponseEntity<ApiResponse<WholesaleOfferDto>> pause(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Wholesale offer paused",
                offerService.pauseOffer(userDetails.getUsername(), id)));
    }

    @PostMapping("/{id}/resume")
    public ResponseEntity<ApiResponse<WholesaleOfferDto>> resume(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Wholesale offer resumed",
                offerService.resumeOffer(userDetails.getUsername(), id)));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<WholesaleOfferDto>> cancel(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) WholesaleReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Wholesale offer cancelled",
                offerService.cancelOffer(userDetails.getUsername(), id, reason(request))));
    }

    @GetMapping("/{id}/pools")
    public ResponseEntity<ApiResponse<List<WholesalePoolDto>>> getPools(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Wholesale lots retrieved",
                offerService.getSellerOfferPools(userDetails.getUsername(), id)));
    }

    /**
     * The orders one lot produced, so the seller can fulfil the lot without leaving the offer view.
     * Status changes still go through PUT /api/v1/seller/orders/{orderNumber}/status.
     */
    @GetMapping("/pools/{poolId}/orders")
    public ResponseEntity<ApiResponse<List<OrderDto>>> getPoolOrders(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID poolId) {
        return ResponseEntity.ok(ApiResponse.success("Wholesale lot orders retrieved",
                poolService.getPoolOrders(userDetails.getUsername(), poolId)));
    }

    private static String reason(WholesaleReasonRequest request) {
        return request != null ? request.getReason() : null;
    }
}
