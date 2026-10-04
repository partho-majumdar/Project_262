package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A seller-defined Reverse Group Buying offer: the reusable configuration customers collectively
 * build demand against.
 * <p>
 * This is a standalone purchasing mechanism, unrelated to {@link WholesaleOffer} (CWP). There is no
 * wholesale minimum and no wholesale price here: the seller declares a target condition
 * ({@link ReverseTargetType}, {@code targetValue}, {@code targetQuantity}) and the purchasing
 * condition that is unlocked once enough collective demand has accumulated.
 * <p>
 * Inventory protection: unlike CWP, which reserves a whole lot's capacity when a pool opens, a
 * Reverse Group Buying offer reserves stock incrementally, one participation at a time, through the
 * shared {@code ProductRepository.decrementStockIfAvailable}. {@code currentDemand} and
 * {@code participantCount} are aggregates maintained inside the same transaction, and the
 * {@code @Version} column plus a PESSIMISTIC_WRITE row lock on this table serialize concurrent
 * participations so demand can never exceed {@code availableQuantity} and stock can never oversell.
 */
@Entity
@Table(name = "reverse_group_buying_offers", indexes = {
        @Index(name = "idx_rgb_offer_status", columnList = "status"),
        @Index(name = "idx_rgb_offer_store", columnList = "seller_store_id"),
        @Index(name = "idx_rgb_offer_product", columnList = "product_id"),
        @Index(name = "idx_rgb_offer_deadline", columnList = "status, participation_deadline")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReverseGroupBuyingOffer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_store_id", nullable = false)
    private SellerStore sellerStore;

    @Column(name = "description", length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private ReverseGroupBuyingOfferStatus status = ReverseGroupBuyingOfferStatus.DRAFT;

    /** The product's normal price today, kept as a snapshot for the "you save" display. */
    @Column(name = "base_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal basePrice;

    /** Maximum collective quantity this offer can absorb before it runs out of room. */
    @Column(name = "available_quantity", nullable = false)
    private int availableQuantity;

    /** The seller-defined condition customers must collectively satisfy. */
    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 30)
    private ReverseTargetType targetType;

    /**
     * Extra condition value, interpreted per {@link ReverseTargetType}: the discount percentage for
     * DISCOUNT_THRESHOLD, otherwise null.
     */
    @Column(name = "target_value", precision = 12, scale = 2)
    private BigDecimal targetValue;

    /** Collective demand, in units, required to unlock the purchasing condition. */
    @Column(name = "target_quantity", nullable = false)
    private int targetQuantity;

    /** The price each customer pays per unit once the condition is unlocked. Known from the start. */
    @Column(name = "unlocked_unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unlockedUnitPrice;

    @Column(name = "min_quantity_per_customer", nullable = false)
    @Builder.Default
    private int minQuantityPerCustomer = 1;

    @Column(name = "max_quantity_per_customer", nullable = false)
    private int maxQuantityPerCustomer;

    @Column(name = "participation_deadline", nullable = false)
    private LocalDateTime participationDeadline;

    /** Sum of quantities across PARTICIPATING participations. */
    @Column(name = "current_demand", nullable = false)
    @Builder.Default
    private int currentDemand = 0;

    @Column(name = "participant_count", nullable = false)
    @Builder.Default
    private int participantCount = 0;

    /** Latches the "almost complete" seller alert so it fires once per approach, not once per unit. */
    @Column(name = "almost_complete_notified", nullable = false)
    @Builder.Default
    private boolean almostCompleteNotified = false;

    @Column(name = "target_reached_at")
    private LocalDateTime targetReachedAt;

    @Column(name = "activated_at")
    private LocalDateTime activatedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "close_code", length = 40)
    private ReverseGroupBuyingCloseCode closeCode;

    @Column(name = "close_note", length = 500)
    private String closeNote;

    @Version
    @Column(name = "version")
    private Long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public int getRemainingDemand() {
        return Math.max(0, availableQuantity - currentDemand);
    }

    /** Remaining units needed to unlock the purchasing condition. */
    public int getRemainingToTarget() {
        return Math.max(0, targetQuantity - currentDemand);
    }

    public boolean isTargetReached() {
        return currentDemand >= targetQuantity;
    }

    /** 0-100 progress toward the target condition, for progress bars. */
    public int getTargetProgressPercent() {
        if (targetQuantity <= 0) {
            return 100;
        }
        return Math.min(100, (int) Math.round((currentDemand * 100.0) / targetQuantity));
    }
}
