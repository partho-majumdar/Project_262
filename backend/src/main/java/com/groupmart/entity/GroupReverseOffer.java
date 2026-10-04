package com.groupmart.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * One seller's competing offer to fulfil a group reverse demand.
 * <p>
 * Several sellers may bid for the same demand, and the group leader - not the system, and not the
 * lowest price - picks the winner. Nothing here is ranked or auto-selected; the offer carries only
 * the factual terms the comparison screen needs.
 * <p>
 * A seller may revise a {@link GroupReverseOfferStatus#SUBMITTED} offer, so a store can improve its
 * terms before the deadline. Once the offer is {@code ACCEPTED} its price and quantity are final:
 * revision and withdrawal are both refused.
 */
@Entity
@Table(name = "group_reverse_offers", indexes = {
        @Index(name = "idx_gro_demand", columnList = "demand_id"),
        @Index(name = "idx_gro_store", columnList = "seller_store_id"),
        @Index(name = "idx_gro_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupReverseOffer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "demand_id", nullable = false)
    private GroupReverseDemand demand;

    /** The competing seller. May be a different store from the product's catalog owner. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_store_id", nullable = false)
    private SellerStore sellerStore;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    /**
     * Units this seller commits to supplying. Must be at least the demand's required quantity: a
     * seller may not bid for a group it cannot fulfil whole.
     */
    @Column(name = "offered_quantity", nullable = false)
    private int offeredQuantity;

    @Column(name = "delivery_fee", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal deliveryFee = BigDecimal.ZERO;

    @Column(name = "estimated_delivery_days", nullable = false)
    private int estimatedDeliveryDays;

    @Column(name = "warranty_months")
    private Integer warrantyMonths;

    /** The store's own message to the group. */
    @Column(name = "message", length = 1000)
    private String message;

    /** When this particular offer stops being selectable, capped by the demand's offer deadline. */
    @Column(name = "offer_expiry", nullable = false)
    private LocalDateTime offerExpiry;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private GroupReverseOfferStatus status = GroupReverseOfferStatus.SUBMITTED;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

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

    /** What the whole group would pay this seller: goods plus the delivery charge. */
    public BigDecimal computeGroupTotal() {
        BigDecimal goods = unitPrice.multiply(BigDecimal.valueOf(offeredQuantity));
        return goods.add(deliveryFee == null ? BigDecimal.ZERO : deliveryFee);
    }

    public boolean isSelectable(LocalDateTime now) {
        return status == GroupReverseOfferStatus.SUBMITTED && offerExpiry.isAfter(now);
    }
}
