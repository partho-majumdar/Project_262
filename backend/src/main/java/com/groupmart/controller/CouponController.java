package com.groupmart.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.coupon.ApplyCouponRequest;
import com.groupmart.dto.coupon.CouponDto;
import com.groupmart.dto.coupon.CouponValidationResponse;
import com.groupmart.entity.Order;
import com.groupmart.entity.User;
import com.groupmart.repository.OrderRepository;
import com.groupmart.repository.UserRepository;
import com.groupmart.service.CouponService;
import com.groupmart.service.PlatformSettingService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/v1/coupons")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class CouponController {

    private final OrderRepository orderRepository;
    private final CouponService couponService;
    private final UserRepository userRepository;
    private final PlatformSettingService platformSettingService;

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> getCustomerCoupons(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userDetails.getUsername()));

        // Mapped to DTOs by the service: returning the entities themselves dragged in the
        // Hibernate lazy proxy on Coupon.sellerStore and failed JSON serialisation with a 500.
        List<CouponDto> activeCoupons = couponService.getActivePublicCoupons();

        List<Order> userOrders = orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId());

        BigDecimal totalSpent = userOrders.stream()
                .map(Order::getTotalAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, String> settings = platformSettingService.getSettingsAsMap();
        BigDecimal pointsMultiplier = new BigDecimal(settings.getOrDefault("loyalty.points.multiplier", "10"));
        BigDecimal cashbackRate = new BigDecimal(settings.getOrDefault("loyalty.cashback.rate", "0.02"));

        long rewardPoints = userOrders.stream()
                .mapToLong(o -> o.getTotalAmount().multiply(pointsMultiplier).longValue())
                .sum();

        BigDecimal tier1 = new BigDecimal(settings.getOrDefault("loyalty.tier.silver.threshold", "500"));
        BigDecimal tier2 = new BigDecimal(settings.getOrDefault("loyalty.tier.gold.threshold", "2000"));
        BigDecimal tier3 = new BigDecimal(settings.getOrDefault("loyalty.tier.platinum.threshold", "5000"));

        String membershipTier;
        if (totalSpent.compareTo(tier3) >= 0) {
            membershipTier = "PLATINUM";
        } else if (totalSpent.compareTo(tier2) >= 0) {
            membershipTier = "GOLD";
        } else if (totalSpent.compareTo(tier1) >= 0) {
            membershipTier = "SILVER";
        } else {
            membershipTier = "BRONZE";
        }

        BigDecimal cashbackEarned = totalSpent.multiply(cashbackRate)
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal pointsRedemptionRate = new BigDecimal(settings.getOrDefault("loyalty.points.redemption.rate", "100"));

        Map<String, Object> data = new HashMap<>();
        data.put("availableCoupons", activeCoupons);
        data.put("rewardPoints", rewardPoints);
        data.put("membershipTier", membershipTier);
        data.put("cashbackEarned", cashbackEarned);
        data.put("totalSpent", totalSpent);
        data.put("totalOrders", userOrders.size());
        data.put("pointsRedemptionRate", pointsRedemptionRate);
        data.put("cashbackRate", cashbackRate);

        return ResponseEntity.ok(ApiResponse.success("Coupons and rewards retrieved", data));
    }

    @PostMapping("/validate")
    public ResponseEntity<ApiResponse<CouponValidationResponse>> validateCoupon(
            @RequestBody ApplyCouponRequest request
    ) {
        CouponValidationResponse response = couponService.validateAndCalculateCoupon(request);
        if (!response.isValid()) {
            throw new ApiException(response.getMessage(), HttpStatus.BAD_REQUEST);
        }
        return ResponseEntity.ok(ApiResponse.success("Coupon code verified successfully", response));
    }
}
