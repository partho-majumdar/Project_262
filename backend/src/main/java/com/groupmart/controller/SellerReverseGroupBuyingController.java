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
import com.groupmart.dto.reverse.*;
import com.groupmart.service.ReverseGroupBuyingOfferService;

import java.util.List;
import java.util.UUID;

/**
 * Seller management of Reverse Group Buying offers: configure the target condition, publish it, watch
 * the collective demand, and manage the resulting campaign. Separate from
 * {@link SellerWholesaleController} (CWP), which is left untouched.
 */
@RestController
@RequestMapping("/api/v1/seller/reverse-group-buying")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SELLER', 'ADMIN')")
public class SellerReverseGroupBuyingController {

    private final ReverseGroupBuyingOfferService offerService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ReverseGroupBuyingOfferDto>>> getOffers(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success("Reverse group buying offers retrieved",
                offerService.getSellerOffers(userDetails.getUsername())));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ReverseGroupBuyingOfferDto>> getOffer(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Reverse group buying offer retrieved",
                offerService.getSellerOffer(userDetails.getUsername(), id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ReverseGroupBuyingOfferDto>> createOffer(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ReverseGroupBuyingOfferRequest request) {
        ReverseGroupBuyingOfferDto created = offerService.createOffer(userDetails.getUsername(), request);
        return new ResponseEntity<>(
                ApiResponse.success("Reverse group buying offer saved as draft", created, HttpStatus.CREATED.value()),
                HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ReverseGroupBuyingOfferDto>> updateOffer(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody ReverseGroupBuyingOfferRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Reverse group buying offer updated",
                offerService.updateOffer(userDetails.getUsername(), id, request)));
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<ApiResponse<ReverseGroupBuyingOfferDto>> activate(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Offer is now collecting customer demand",
                offerService.activateOffer(userDetails.getUsername(), id)));
    }

    @PostMapping("/{id}/close")
    public ResponseEntity<ApiResponse<ReverseGroupBuyingOfferDto>> close(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) ReverseGroupBuyingReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Offer closed and participations refunded",
                offerService.closeOffer(userDetails.getUsername(), id,
                        request != null ? request.getReason() : null)));
    }

    @PostMapping("/{id}/fulfillment")
    public ResponseEntity<ApiResponse<ReverseGroupBuyingOfferDto>> startFulfillment(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Offer moved to fulfillment",
                offerService.startFulfillment(userDetails.getUsername(), id)));
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<ApiResponse<ReverseGroupBuyingOfferDto>> complete(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Offer completed",
                offerService.completeOffer(userDetails.getUsername(), id)));
    }

    @GetMapping("/{id}/participations")
    public ResponseEntity<ApiResponse<List<ReverseGroupBuyingParticipationDto>>> getParticipations(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Offer participations retrieved",
                offerService.getSellerOfferParticipations(userDetails.getUsername(), id)));
    }

    @GetMapping("/{id}/campaign")
    public ResponseEntity<ApiResponse<ReverseGroupBuyingCampaignDto>> getCampaign(
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Campaign retrieved",
                offerService.getCampaignForOffer(id)));
    }
}
