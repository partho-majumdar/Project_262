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
import com.groupmart.dto.seller.*;
import com.groupmart.service.SellerService;

@RestController
@RequestMapping("/api/v1/seller")
@RequiredArgsConstructor
public class SellerController {

    private final SellerService sellerService;

    @PostMapping("/store")
    public ResponseEntity<ApiResponse<SellerStoreDto>> createStore(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CreateSellerStoreRequest request
    ) {
        SellerStoreDto store = sellerService.createSellerStore(userDetails.getUsername(), request);
        return new ResponseEntity<>(ApiResponse.success("Seller store registered successfully", store, HttpStatus.CREATED.value()), HttpStatus.CREATED);
    }

    @GetMapping("/store/me")
    @PreAuthorize("hasAnyRole('SELLER', 'ADMIN')")
    public ResponseEntity<ApiResponse<SellerStoreDto>> getMyStore(@AuthenticationPrincipal UserDetails userDetails) {
        SellerStoreDto store = sellerService.getSellerStoreByEmail(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Seller store details fetched", store));
    }

    @PutMapping("/store/me")
    @PreAuthorize("hasAnyRole('SELLER', 'ADMIN')")
    public ResponseEntity<ApiResponse<SellerStoreDto>> updateMyStore(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody UpdateSellerStoreRequest request
    ) {
        SellerStoreDto updated = sellerService.updateSellerStore(userDetails.getUsername(), request);
        return ResponseEntity.ok(ApiResponse.success("Seller store updated successfully", updated));
    }

    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyRole('SELLER', 'ADMIN')")
    public ResponseEntity<ApiResponse<SellerDashboardOverviewDto>> getDashboardOverview(@AuthenticationPrincipal UserDetails userDetails) {
        SellerDashboardOverviewDto overview = sellerService.getSellerDashboardOverview(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Seller dashboard overview retrieved", overview));
    }
}
