package com.groupmart.dto.coupon;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.groupmart.entity.DiscountType;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CouponDto {

    private UUID id;
    private String code;
    private DiscountType discountType;
    private BigDecimal discountValue;
    private BigDecimal minOrderAmount;
    private BigDecimal maxDiscountAmount;
    private Integer usageLimit;
    private int timesUsed;
    private LocalDateTime expiryDate;
    private boolean active;
}
