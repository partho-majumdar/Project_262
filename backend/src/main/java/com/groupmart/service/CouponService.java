package com.groupmart.service;

import java.util.List;
import java.util.UUID;

import com.groupmart.dto.coupon.ApplyCouponRequest;
import com.groupmart.dto.coupon.CouponDto;
import com.groupmart.dto.coupon.CouponValidationResponse;
import com.groupmart.dto.coupon.CreateCouponRequest;

public interface CouponService {

    CouponValidationResponse validateAndCalculateCoupon(ApplyCouponRequest request);

    List<CouponDto> getActivePublicCoupons();

    List<CouponDto> getAllCoupons();

    CouponDto createCoupon(String adminEmail, CreateCouponRequest request);

    CouponDto toggleCouponStatus(String adminEmail, UUID couponId, boolean active);

    void incrementCouponUsage(String code);
}
