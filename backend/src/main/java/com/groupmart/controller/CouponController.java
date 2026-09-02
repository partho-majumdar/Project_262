package com.groupmart.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.common.response.ApiResponse;
import com.groupmart.entity.Coupon;
import com.groupmart.entity.DiscountType;
import com.groupmart.repository.CouponRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/coupons")
@RequiredArgsConstructor
public class CouponController {

    private final CouponRepository couponRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> getCustomerCoupons() {
        List<Coupon> activeCoupons = couponRepository.findByActiveTrue()
                .stream()
                .filter(c -> c.getExpiryDate() == null || c.getExpiryDate().isAfter(LocalDateTime.now()))
                .collect(Collectors.toList());

        Map<String, Object> data = new HashMap<>();
        data.put("availableCoupons", activeCoupons);
        // No fake numbers — real loyalty can be wired later from User/orders
        data.put("rewardPoints", 0);
        data.put("membershipTier", null);
        data.put("cashbackEarned", BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));

        return ResponseEntity.ok(ApiResponse.success("Coupons and rewards retrieved", data));
    }

    @PostMapping("/validate")
    public ResponseEntity<ApiResponse<Map<String, Object>>> validateCoupon(
            @RequestBody Map<String, Object> body
    ) {
        Object codeObj = body != null ? body.get("code") : null;
        String code = codeObj != null ? codeObj.toString().trim() : "";

        if (code.isEmpty()) {
            throw new ApiException("Coupon code is required", HttpStatus.BAD_REQUEST);
        }

        BigDecimal subtotal = BigDecimal.ZERO;
        if (body.get("subtotal") != null) {
            try {
                subtotal = new BigDecimal(body.get("subtotal").toString());
            } catch (Exception e) {
                subtotal = BigDecimal.ZERO;
            }
        }

        Coupon coupon = couponRepository.findByCodeIgnoreCaseAndActiveTrue(code)
                .orElseThrow(() -> new ResourceNotFoundException("Coupon", "code", code));

        if (coupon.getExpiryDate() != null && coupon.getExpiryDate().isBefore(LocalDateTime.now())) {
            throw new ApiException("This coupon has expired", HttpStatus.BAD_REQUEST);
        }

        if (coupon.getUsageLimit() != null
                && coupon.getTimesUsed() != null
                && coupon.getTimesUsed() >= coupon.getUsageLimit()) {
            throw new ApiException("This coupon has reached its usage limit", HttpStatus.BAD_REQUEST);
        }

        if (coupon.getMinOrderAmount() != null
                && subtotal.compareTo(coupon.getMinOrderAmount()) < 0) {
            throw new ApiException(
                    "Minimum order amount is " + coupon.getMinOrderAmount(),
                    HttpStatus.BAD_REQUEST
            );
        }

        BigDecimal calculatedDiscount = calculateDiscount(coupon, subtotal);

        Map<String, Object> result = new HashMap<>();
        result.put("valid", true);
        result.put("code", coupon.getCode());
        result.put("description", coupon.getDescription());
        result.put("discountType", coupon.getDiscountType() != null ? coupon.getDiscountType().name() : null);
        result.put("discountValue", coupon.getDiscountValue());
        result.put("minOrderAmount", coupon.getMinOrderAmount());
        result.put("maxDiscountAmount", coupon.getMaxDiscountAmount());
        result.put("calculatedDiscount", calculatedDiscount);
        result.put("message", "Coupon applied successfully");

        return ResponseEntity.ok(ApiResponse.success("Coupon code verified successfully", result));
    }

    private BigDecimal calculateDiscount(Coupon coupon, BigDecimal subtotal) {
        if (subtotal == null || subtotal.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        BigDecimal discount = BigDecimal.ZERO;

        if (coupon.getDiscountType() == DiscountType.PERCENTAGE) {
            discount = subtotal
                    .multiply(coupon.getDiscountValue())
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        } else if (coupon.getDiscountType() == DiscountType.FIXED_AMOUNT) {
            discount = coupon.getDiscountValue() != null
                    ? coupon.getDiscountValue()
                    : BigDecimal.ZERO;
        }

        if (coupon.getMaxDiscountAmount() != null
                && discount.compareTo(coupon.getMaxDiscountAmount()) > 0) {
            discount = coupon.getMaxDiscountAmount();
        }

        if (discount.compareTo(subtotal) > 0) {
            discount = subtotal;
        }

        return discount.setScale(2, RoundingMode.HALF_UP);
    }
}
