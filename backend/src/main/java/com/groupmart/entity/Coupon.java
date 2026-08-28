package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "coupons")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Coupon {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_store_id")
    private SellerStore sellerStore;   // null = platform-wide coupon

    @Column(nullable = false, unique = true)
    private String code;

    @Builder.Default
    @Column(nullable = false)
    private String description = "Promotional Discount Coupon";

    @Enumerated(EnumType.STRING)
    @Column(name = "discount_type", nullable = false)
    private DiscountType discountType; // PERCENTAGE or FIXED_AMOUNT

    @Column(name = "discount_value", nullable = false)
    private BigDecimal discountValue;

    @Column(name = "min_order_amount")
    private BigDecimal minOrderAmount;

    @Column(name = "max_discount_amount")
    private BigDecimal maxDiscountAmount;

    @Column(name = "usage_limit")
    private Integer usageLimit;

    @Column(name = "times_used")
    @Builder.Default
    private Integer timesUsed = 0;

    @Column(name = "expiry_date")
    private LocalDateTime expiryDate;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;
}
