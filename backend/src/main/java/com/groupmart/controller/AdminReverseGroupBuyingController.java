package com.groupmart.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.reverse.ReverseGroupBuyingOfferDto;
import com.groupmart.dto.reverse.ReverseGroupBuyingReasonRequest;
import com.groupmart.service.ReverseGroupBuyingOfferService;

import java.util.List;
import java.util.UUID;

/**
 * Administrative oversight of Reverse Group Buying: read every seller's offers and force-close one
 * that has to be stopped. Just like the CWP admin endpoints, there is no approval gate - sellers
 * publish their own offers - so admin actions here are limited to visibility and emergency closure.
 */
@RestController
@RequestMapping("/api/v1/admin/reverse-group-buying")
@RequiredArgsConstructor
public class AdminReverseGroupBuyingController {

    private final ReverseGroupBuyingOfferService offerService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ReverseGroupBuyingOfferDto>>> getOffers(
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success("Reverse group buying offers retrieved",
                offerService.getAllOffers(status)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ReverseGroupBuyingOfferDto>> getOffer(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Reverse group buying offer retrieved",
                offerService.getPublicOffer(id)));
    }

    @PostMapping("/{id}/force-close")
    public ResponseEntity<ApiResponse<ReverseGroupBuyingOfferDto>> forceClose(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) ReverseGroupBuyingReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Offer force-closed and participations refunded",
                offerService.forceCloseOffer(null, id, request != null ? request.getReason() : null)));
    }
}
