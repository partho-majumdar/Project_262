package com.groupmart.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * A customer-created group purchasing demand: "N of us will buy M units of this product at or below
 * P, and we want sellers to bid for the business."
 * <p>
 * This is the parent aggregate for the whole mechanism. Its {@code leader} is the customer who
 * created it, and the leader holds the only offer-selection authority; the leader is emphatically
 * <em>not</em> treated as the buyer for anybody else's quantity. Every member, the leader included,
 * ends up with their own order.
 * <p>
 * <b>Direction of initiation is the defining difference from
 * {@link ReverseGroupBuyingCampaign}.</b> There, a seller declares the target condition and the
 * unlocked price and customers supply demand to unlock it. Here a customer declares the quantity and
 * the acceptable price, and multiple sellers compete to win the resulting group order. The two are
 * separate mechanisms with separate tables, services, routes and business rules.
 * <p>
 * <b>Concurrency.</b> {@code committedQuantity} and {@code memberCount} are aggregates maintained
 * inside the joining transaction, and the {@code @Version} column plus the PESSIMISTIC_WRITE row
 * lock used by the service serialize concurrent joins. Demand therefore can never exceed
 * {@code requiredQuantity}: oversubscription is prevented by the database, not by a check that
 * races.
 * <p>
 * <b>Inventory.</b> Nothing is reserved while demand accumulates, because no seller is committed
 * yet. Stock is only taken when an offer is accepted, at which point the whole group quantity must
 * be available or the selection is refused.
 */
@Entity
@Table(name = "group_reverse_demands", indexes = {
        @Index(name = "idx_grd_status", columnList = "status"),
        @Index(name = "idx_grd_leader", columnList = "leader_id"),
        @Index(name = "idx_grd_product", columnList = "product_id"),
        @Index(name = "idx_grd_join_deadline", columnList = "status, join_deadline"),
        @Index(name = "idx_grd_offer_deadline", columnList = "status, offer_deadline")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupReverseDemand {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    /**
     * The product being demanded. This is the reference item: it fixes the specification, the
     * image and the price every seller is bidding against. It does not commit anybody's fulfilment -
     * that belongs to whichever seller's offer the leader selects.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    /** The customer who created the demand and who alone may select an offer. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "leader_id", nullable = false)
    private User leader;

    @Column(name = "description", length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private GroupReverseDemandStatus status = GroupReverseDemandStatus.DRAFT;

    /** The group size that must be assembled before sellers are invited to bid. */
    @Column(name = "required_quantity", nullable = false)
    private int requiredQuantity;

    /** The price the group is aiming for, shown to members and to competing sellers. */
    @Column(name = "target_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal targetPrice;

    /**
     * The most the creator is willing to accept. A seller offer above this is refused at submission
     * so the leader is never handed a choice the demand itself already rules out.
     */
    @Column(name = "max_price", precision = 12, scale = 2)
    private BigDecimal maxPrice;

    @Column(name = "min_quantity_per_member", nullable = false)
    @Builder.Default
    private int minQuantityPerMember = 1;

    @Column(name = "max_quantity_per_member", nullable = false)
    private int maxQuantityPerMember;

    /** After this instant no new member may join. */
    @Column(name = "join_deadline", nullable = false)
    private LocalDateTime joinDeadline;

    /** After this instant no new seller offer may be submitted, and the leader can no longer select. */
    @Column(name = "offer_deadline", nullable = false)
    private LocalDateTime offerDeadline;

    /** Where the group wants the goods delivered. Individual members still ship to their own address. */
    @Column(name = "delivery_city", length = 100)
    private String deliveryCity;

    @Column(name = "required_delivery_date")
    private LocalDate requiredDeliveryDate;

    // ---- Group aggregates, maintained transactionally -------------------------------------------

    /** Sum of requested quantities across active members. Never allowed to exceed requiredQuantity. */
    @Column(name = "committed_quantity", nullable = false)
    @Builder.Default
    private int committedQuantity = 0;

    @Column(name = "member_count", nullable = false)
    @Builder.Default
    private int memberCount = 0;

    @Column(name = "offer_count", nullable = false)
    @Builder.Default
    private int offerCount = 0;

    // ---- The locked commercial outcome ----------------------------------------------------------

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "selected_offer_id")
    private GroupReverseOffer selectedOffer;

    /** The unit price every member pays. Written once at selection and never recalculated. */
    @Column(name = "locked_unit_price", precision = 12, scale = 2)
    private BigDecimal lockedUnitPrice;

    /** The seller-committed delivery charge, split per member at order creation. */
    @Column(name = "locked_delivery_fee", precision = 12, scale = 2)
    private BigDecimal lockedDeliveryFee;

    @Column(name = "locked_estimated_delivery_days")
    private Integer lockedEstimatedDeliveryDays;

    @Column(name = "locked_warranty_months")
    private Integer lockedWarrantyMonths;

    // ---- Milestones ------------------------------------------------------------------------------

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(name = "target_reached_at")
    private LocalDateTime targetReachedAt;

    @Column(name = "offer_selected_at")
    private LocalDateTime offerSelectedAt;

    @Column(name = "orders_created_at")
    private LocalDateTime ordersCreatedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "close_code", length = 40)
    private GroupReverseCloseCode closeCode;

    @Column(name = "close_note", length = 500)
    private String closeNote;

    @Version
    @Column(name = "version")
    private Long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public int getRemainingQuantity() {
        return Math.max(0, requiredQuantity - committedQuantity);
    }

    public boolean isTargetReached() {
        return committedQuantity >= requiredQuantity;
    }

    /** 0-100 progress toward the group target, for progress bars. */
    public int getProgressPercent() {
        if (requiredQuantity <= 0) {
            return 100;
        }
        return Math.min(100, (int) Math.round(committedQuantity * 100.0 / requiredQuantity));
    }

    public boolean hasMaxPrice() {
        return maxPrice != null;
    }
}
