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
import com.groupmart.dto.coupon.CouponDto;
import com.groupmart.dto.coupon.CreateCouponRequest;
import com.groupmart.service.CouponService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/seller/coupons")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SELLER', 'ADMIN')")
public class SellerCouponController {

    private final CouponService couponService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<CouponDto>>> getCoupons() {
        List<CouponDto> coupons = couponService.getAllCoupons();
        return ResponseEntity.ok(ApiResponse.success("Coupons retrieved", coupons));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CouponDto>> createCoupon(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CreateCouponRequest request
    ) {
        CouponDto created = couponService.createCoupon(userDetails.getUsername(), request);
        return new ResponseEntity<>(
                ApiResponse.success("Coupon created successfully", created, HttpStatus.CREATED.value()),
                HttpStatus.CREATED
        );
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ApiResponse<CouponDto>> toggleStatus(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @RequestParam boolean active
    ) {
        CouponDto updated = couponService.toggleCouponStatus(userDetails.getUsername(), id, active);
        return ResponseEntity.ok(ApiResponse.success("Coupon status updated", updated));
    }
}

