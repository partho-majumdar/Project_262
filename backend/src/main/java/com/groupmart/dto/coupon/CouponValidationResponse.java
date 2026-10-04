package com.groupmart.dto.coupon;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

import com.groupmart.entity.DiscountType;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CouponValidationResponse {

    private boolean valid;
    private String code;
    private String description;
    private DiscountType discountType;
    private BigDecimal discountValue;
    private BigDecimal minOrderAmount;
    private BigDecimal maxDiscountAmount;
    private BigDecimal calculatedDiscount;
    private String message;
}
