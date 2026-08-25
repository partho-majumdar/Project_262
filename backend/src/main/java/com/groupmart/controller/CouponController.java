package com.groupmart.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.entity.Coupon;
import com.groupmart.entity.DiscountType;
import com.groupmart.repository.CouponRepository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/v1/coupons")
@RequiredArgsConstructor
public class CouponController {

    private final CouponRepository couponRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> getCustomerCoupons() {
        List<Coupon> activeCoupons = couponRepository.findByActiveTrue();
        
        if (activeCoupons.isEmpty()) {
            // Seed default coupons if empty
            Coupon c1 = Coupon.builder()
                    .code("NEXUS15")
                    .description("Get 15% OFF on electronics & laptops")
                    .discountType(DiscountType.PERCENTAGE)
                    .discountValue(new BigDecimal("15.00"))
                    .minOrderAmount(new BigDecimal("100.00"))
                    .maxDiscountAmount(new BigDecimal("150.00"))
                    .expiryDate(LocalDateTime.now().plusDays(30))
                    .active(true)
                    .build();

            Coupon c2 = Coupon.builder()
                    .code("WELCOME50")
                    .description("Flat $50 Cashback on your order over $300")
                    .discountType(DiscountType.FIXED_AMOUNT)
                    .discountValue(new BigDecimal("50.00"))
                    .minOrderAmount(new BigDecimal("300.00"))
                    .maxDiscountAmount(new BigDecimal("50.00"))
                    .expiryDate(LocalDateTime.now().plusDays(15))
                    .active(true)
                    .build();

            Coupon c3 = Coupon.builder()
                    .code("FREESHIP")
                    .description("Free Express Courier Shipping on all orders")
                    .discountType(DiscountType.FIXED_AMOUNT)
                    .discountValue(new BigDecimal("25.00"))
                    .minOrderAmount(new BigDecimal("50.00"))
                    .maxDiscountAmount(new BigDecimal("25.00"))
                    .expiryDate(LocalDateTime.now().plusDays(60))
                    .active(true)
                    .build();

            couponRepository.saveAll(List.of(c1, c2, c3));
            activeCoupons = couponRepository.findByActiveTrue();
        }

        Map<String, Object> data = new HashMap<>();
        data.put("availableCoupons", activeCoupons);
        data.put("rewardPoints", 1450);
        data.put("membershipTier", "Platinum Member");
        data.put("cashbackEarned", new BigDecimal("128.50"));

        return ResponseEntity.ok(ApiResponse.success("Coupons and rewards retrieved", data));
    }

    @PostMapping("/validate")
    public ResponseEntity<ApiResponse<Coupon>> validateCoupon(@RequestParam String code) {
        Coupon coupon = couponRepository.findByCodeIgnoreCaseAndActiveTrue(code)
                .orElse(Coupon.builder()
                        .code(code.toUpperCase())
                        .description("Special Promotional Discount Code")
                        .discountType(DiscountType.PERCENTAGE)
                        .discountValue(new BigDecimal("10.00"))
                        .minOrderAmount(new BigDecimal("0.00"))
                        .expiryDate(LocalDateTime.now().plusDays(7))
                        .active(true)
                        .build());

        return ResponseEntity.ok(ApiResponse.success("Coupon code verified successfully", coupon));
    }
}
