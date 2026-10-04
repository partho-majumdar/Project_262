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
import com.groupmart.service.ReverseGroupBuyingParticipationService;

import java.util.List;
import java.util.UUID;

/**
 * Customer-facing Reverse Group Buying: the dedicated marketplace, contributing demand, withdrawing
 * a participation, and one's own participation dashboard.
 * <p>
 * Separate from {@link WholesaleController} (CWP) on purpose - a Reverse Group Buying offer unlocks a
 * seller-defined purchasing condition, it does not pool toward a wholesale minimum.
 */
@RestController
@RequestMapping("/api/v1/reverse-group-buying")
@RequiredArgsConstructor
public class ReverseGroupBuyingController {

    private final ReverseGroupBuyingOfferService offerService;
    private final ReverseGroupBuyingParticipationService participationService;

    @GetMapping("/offers")
    public ResponseEntity<ApiResponse<List<ReverseGroupBuyingOfferDto>>> getMarketplaceOffers() {
        return ResponseEntity.ok(ApiResponse.success("Reverse group buying offers retrieved",
                offerService.getMarketplaceOffers()));
    }

    @GetMapping("/offers/{offerId}")
    public ResponseEntity<ApiResponse<ReverseGroupBuyingOfferDto>> getOffer(@PathVariable UUID offerId) {
        return ResponseEntity.ok(ApiResponse.success("Reverse group buying offer retrieved",
                offerService.getPublicOffer(offerId)));
    }

    @GetMapping("/offers/{offerId}/campaign")
    public ResponseEntity<ApiResponse<ReverseGroupBuyingCampaignDto>> getCampaign(@PathVariable UUID offerId) {
        return ResponseEntity.ok(ApiResponse.success("Reverse group buying campaign retrieved",
                offerService.getCampaignForOffer(offerId)));
    }

    @PostMapping("/offers/{offerId}/participate")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<ReverseGroupBuyingParticipationDto>> participate(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID offerId,
            @Valid @RequestBody ReverseGroupBuyingParticipationRequest request) {
        ReverseGroupBuyingParticipationDto participation =
                participationService.participate(userDetails.getUsername(), offerId, request);
        return new ResponseEntity<>(
                ApiResponse.success("Demand added to the reverse group buying offer", participation,
                        HttpStatus.CREATED.value()),
                HttpStatus.CREATED);
    }

    @PostMapping("/participations/{id}/cancel")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<ReverseGroupBuyingParticipationDto>> cancelParticipation(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) ReverseGroupBuyingReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Participation withdrawn and refunded",
                participationService.cancelParticipation(userDetails.getUsername(), id,
                        request != null ? request.getReason() : null)));
    }

    @GetMapping("/participations")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<ReverseGroupBuyingParticipationDto>>> getMyParticipations(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success("Your reverse group buying participations retrieved",
                participationService.getMyParticipations(userDetails.getUsername())));
    }
}
