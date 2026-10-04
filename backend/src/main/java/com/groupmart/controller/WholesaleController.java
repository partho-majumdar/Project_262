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
import com.groupmart.dto.wholesale.ReserveWholesaleQuantityRequest;
import com.groupmart.dto.wholesale.WholesaleDisputeDto;
import com.groupmart.dto.wholesale.WholesaleDisputeRequest;
import com.groupmart.dto.wholesale.WholesalePoolDto;
import com.groupmart.dto.wholesale.WholesaleReasonRequest;
import com.groupmart.dto.wholesale.WholesaleReservationDto;
import com.groupmart.service.WholesaleDisputeService;
import com.groupmart.service.WholesalePoolService;

import java.util.List;
import java.util.UUID;

/**
 * Customer-facing Collaborative Wholesale Purchasing: the marketplace of open pools, reserving a
 * quantity, and the customer's own reservations dashboard (CWP spec sections 4 and 19).
 */
@RestController
@RequestMapping("/api/v1/wholesale")
@RequiredArgsConstructor
public class WholesaleController {

    private final WholesalePoolService poolService;
    private final WholesaleDisputeService disputeService;

    /** Active/almost-complete lots across all sellers, for the wholesale marketplace section. */
    @GetMapping("/pools")
    public ResponseEntity<ApiResponse<List<WholesalePoolDto>>> getMarketplacePools() {
        return ResponseEntity.ok(ApiResponse.success("Wholesale pools retrieved",
                poolService.getMarketplacePools()));
    }

    @GetMapping("/pools/{poolId}")
    public ResponseEntity<ApiResponse<WholesalePoolDto>> getPool(@PathVariable UUID poolId) {
        return ResponseEntity.ok(ApiResponse.success("Wholesale pool retrieved", poolService.getPool(poolId)));
    }

    @PostMapping("/pools/{poolId}/reserve")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<WholesaleReservationDto>> reserve(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID poolId,
            @Valid @RequestBody ReserveWholesaleQuantityRequest request) {
        WholesaleReservationDto reservation = poolService.reserveQuantity(userDetails.getUsername(), poolId, request);
        return new ResponseEntity<>(
                ApiResponse.success("Quantity reserved", reservation, HttpStatus.CREATED.value()),
                HttpStatus.CREATED);
    }

    @GetMapping("/reservations")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<WholesaleReservationDto>>> getMyReservations(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success("Wholesale reservations retrieved",
                poolService.getMyReservations(userDetails.getUsername())));
    }

    @PostMapping("/reservations/{id}/cancel")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<WholesaleReservationDto>> cancelReservation(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) WholesaleReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Reservation cancelled",
                poolService.cancelReservation(userDetails.getUsername(), id, reason(request))));
    }

    @PostMapping("/reservations/{id}/disputes")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<WholesaleDisputeDto>> openDispute(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody WholesaleDisputeRequest request) {
        WholesaleDisputeDto dispute = disputeService.openDispute(userDetails.getUsername(), id, request);
        return new ResponseEntity<>(
                ApiResponse.success("Report submitted", dispute, HttpStatus.CREATED.value()),
                HttpStatus.CREATED);
    }

    @GetMapping("/disputes")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<WholesaleDisputeDto>>> getMyDisputes(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success("Wholesale disputes retrieved",
                disputeService.getMyDisputes(userDetails.getUsername())));
    }

    private static String reason(WholesaleReasonRequest request) {
        return request != null ? request.getReason() : null;
    }
}
