package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.coupon.ApplyCouponRequest;
import com.groupmart.dto.coupon.CouponDto;
import com.groupmart.dto.coupon.CouponValidationResponse;
import com.groupmart.dto.coupon.CreateCouponRequest;
import com.groupmart.entity.Coupon;
import com.groupmart.entity.DiscountType;
import com.groupmart.repository.CouponRepository;
import com.groupmart.service.CouponService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CouponServiceImpl implements CouponService {

    private final CouponRepository couponRepository;

    @Override
    @Transactional(readOnly = true)
    public CouponValidationResponse validateAndCalculateCoupon(ApplyCouponRequest request) {
        String code = request.getCode().trim().toUpperCase();
        BigDecimal subtotal = request.getSubtotal() != null ? request.getSubtotal() : BigDecimal.ZERO;

        Optional<Coupon> couponOpt = couponRepository.findByCodeIgnoreCase(code);

        if (couponOpt.isEmpty()) {
            return CouponValidationResponse.builder()
                    .valid(false)
                    .code(code)
                    .calculatedDiscount(BigDecimal.ZERO)
                    .message("Invalid promotional coupon code '" + code + "'")
                    .build();
        }

        Coupon coupon = couponOpt.get();

        if (!coupon.isActive()) {
            return CouponValidationResponse.builder()
                    .valid(false)
                    .code(code)
                    .calculatedDiscount(BigDecimal.ZERO)
                    .message("Promotional code '" + code + "' is no longer active")
                    .build();
        }

        if (coupon.getExpiryDate() != null && coupon.getExpiryDate().isBefore(LocalDateTime.now())) {
            return CouponValidationResponse.builder()
                    .valid(false)
                    .code(code)
                    .calculatedDiscount(BigDecimal.ZERO)
                    .message("Promotional code '" + code + "' has expired")
                    .build();
        }

        if (coupon.getUsageLimit() != null && coupon.getTimesUsed() >= coupon.getUsageLimit()) {
            return CouponValidationResponse.builder()
                    .valid(false)
                    .code(code)
                    .calculatedDiscount(BigDecimal.ZERO)
                    .message("Promotional code '" + code + "' has reached maximum redemption limit")
                    .build();
        }

        if (coupon.getMinOrderAmount() != null && subtotal.compareTo(coupon.getMinOrderAmount()) < 0) {
            return CouponValidationResponse.builder()
                    .valid(false)
                    .code(code)
                    .calculatedDiscount(BigDecimal.ZERO)
                    .message(String.format("Coupon '%s' requires a minimum order subtotal of $%.2f", code, coupon.getMinOrderAmount()))
                    .build();
        }

        // Calculate discount deduction amount
        BigDecimal calculatedDiscount = BigDecimal.ZERO;
        if (coupon.getDiscountType() == DiscountType.PERCENTAGE) {
            BigDecimal percentageDecimal = coupon.getDiscountValue().divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP);
            calculatedDiscount = subtotal.multiply(percentageDecimal).setScale(2, RoundingMode.HALF_UP);

            if (coupon.getMaxDiscountAmount() != null && calculatedDiscount.compareTo(coupon.getMaxDiscountAmount()) > 0) {
                calculatedDiscount = coupon.getMaxDiscountAmount();
            }
        } else if (coupon.getDiscountType() == DiscountType.FIXED_AMOUNT) {
            calculatedDiscount = coupon.getDiscountValue();
            if (calculatedDiscount.compareTo(subtotal) > 0) {
                calculatedDiscount = subtotal; // Cap at subtotal
            }
        }

        return CouponValidationResponse.builder()
                .valid(true)
                .code(coupon.getCode())
                .discountType(coupon.getDiscountType())
                .discountValue(coupon.getDiscountValue())
                .calculatedDiscount(calculatedDiscount)
                .message("Coupon promo code applied successfully!")
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CouponDto> getActivePublicCoupons() {
        return couponRepository.findAll().stream()
                .filter(Coupon::isActive)
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<CouponDto> getAllCoupons() {
        return couponRepository.findAll().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public CouponDto createCoupon(String adminEmail, CreateCouponRequest request) {
        String cleanCode = request.getCode().trim().toUpperCase();

        if (couponRepository.existsByCodeIgnoreCase(cleanCode)) {
            throw new ApiException("Coupon code '" + cleanCode + "' already exists", HttpStatus.CONFLICT);
        }

        Coupon coupon = Coupon.builder()
                .code(cleanCode)
                .discountType(request.getDiscountType())
                .discountValue(request.getDiscountValue())
                .minOrderAmount(request.getMinOrderAmount() != null ? request.getMinOrderAmount() : BigDecimal.ZERO)
                .maxDiscountAmount(request.getMaxDiscountAmount())
                .usageLimit(request.getUsageLimit() != null ? request.getUsageLimit() : 1000)
                .timesUsed(0)
                .expiryDate(request.getExpiryDate())
                .active(true)
                .build();

        Coupon saved = couponRepository.save(coupon);
        return mapToDto(saved);
    }

    @Override
    @Transactional
    public CouponDto toggleCouponStatus(String adminEmail, UUID couponId, boolean active) {
        Coupon coupon = couponRepository.findById(couponId)
                .orElseThrow(() -> new ResourceNotFoundException("Coupon", "id", couponId));

        coupon.setActive(active);
        Coupon updated = couponRepository.save(coupon);
        return mapToDto(updated);
    }

    @Override
    @Transactional
    public void incrementCouponUsage(String code) {
        Optional<Coupon> couponOpt = couponRepository.findByCodeIgnoreCase(code);
        if (couponOpt.isPresent()) {
            Coupon coupon = couponOpt.get();
            coupon.setTimesUsed(coupon.getTimesUsed() + 1);
            couponRepository.save(coupon);
        }
    }

    private CouponDto mapToDto(Coupon coupon) {
        return CouponDto.builder()
                .id(coupon.getId())
                .code(coupon.getCode())
                .discountType(coupon.getDiscountType())
                .discountValue(coupon.getDiscountValue())
                .minOrderAmount(coupon.getMinOrderAmount())
                .maxDiscountAmount(coupon.getMaxDiscountAmount())
                .usageLimit(coupon.getUsageLimit())
                .timesUsed(coupon.getTimesUsed())
                .expiryDate(coupon.getExpiryDate())
                .active(coupon.isActive())
                .build();
    }
}
