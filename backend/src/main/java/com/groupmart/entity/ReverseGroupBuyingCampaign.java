package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * The confirmed Reverse Group Buying purchase, created once an offer's target condition is reached
 * and the purchasing condition is unlocked.
 * <p>
 * This is the parent purchasing event for the individual orders that follow: each generated order
 * carries {@code Order.orderType = REVERSE_GROUP_BUYING} and
 * {@code Order.reverseGroupBuyingCampaignId = campaign id}, the same traceability pattern the
 * existing CWP orders use through {@code Order.wholesalePurchaseId}.
 * <p>
 * Its own fields are written once and never recalculated, so later individual order cancellations
 * or refunds can never corrupt the collective campaign.
 */
@Entity
@Table(name = "reverse_group_buying_campaigns", indexes = {
        @Index(name = "idx_rgb_campaign_offer", columnList = "offer_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReverseGroupBuyingCampaign {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "offer_id", nullable = false, unique = true)
    private ReverseGroupBuyingOffer offer;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 30)
    private ReverseTargetType targetType;

    /** Locked at activation: the price every generated order is built from. */
    @Column(name = "unlocked_unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unlockedUnitPrice;

    @Column(name = "base_price_at_activation", nullable = false, precision = 12, scale = 2)
    private BigDecimal basePriceAtActivation;

    @Column(name = "target_quantity", nullable = false)
    private int targetQuantity;

    @Column(name = "total_confirmed_quantity", nullable = false)
    private int totalConfirmedQuantity;

    @Column(name = "participant_count", nullable = false)
    private int participantCount;

    @Column(name = "activated_at", nullable = false)
    private LocalDateTime activatedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
