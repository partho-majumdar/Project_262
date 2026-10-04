package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One live lot/pool instance opened against a WholesaleOffer (CWP spec sections 5-7 and 16).
 * Every valid WholesaleReservation against this pool contributes to pooledQuantity.
 * The @Version column backs the DB-level oversubscription guard (spec section 15): accepting a
 * reservation re-reads and updates this row inside one transaction so concurrent reservations
 * that would push pooledQuantity past the offer's maxAvailableQuantity fail and retry/reject
 * instead of silently overselling.
 */
@Entity
@Table(name = "wholesale_pools", indexes = {
        @Index(name = "idx_wholesale_pool_offer", columnList = "offer_id"),
        @Index(name = "idx_wholesale_pool_status_deadline", columnList = "status, deadline")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WholesalePool {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "offer_id", nullable = false)
    private WholesaleOffer offer;

    // Sequential lot number within the offer (1, 2, 3, ...) - spec section 16, Multiple Wholesale Lots.
    @Column(name = "lot_number", nullable = false)
    private int lotNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private WholesalePoolStatus status = WholesalePoolStatus.OPEN;

    // Snapshot of the offer's terms at the time this pool opened, so an offer edit
    // never changes the terms of a pool already in progress.
    @Column(name = "wholesale_unit_price", nullable = false, precision = 12, scale = 2)
    private java.math.BigDecimal wholesaleUnitPrice;

    @Column(name = "wholesale_minimum_quantity", nullable = false)
    private int wholesaleMinimumQuantity;

    @Column(name = "lot_capacity", nullable = false)
    private int lotCapacity;

    // Sum of quantities across active (RESERVED or CONVERTED) reservations.
    @Column(name = "pooled_quantity", nullable = false)
    @Builder.Default
    private int pooledQuantity = 0;

    @Column(name = "participant_count", nullable = false)
    @Builder.Default
    private int participantCount = 0;

    @Column(name = "deadline", nullable = false)
    private LocalDateTime deadline;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "close_code", length = 40)
    private WholesaleCloseCode closeCode;

    @Column(name = "almost_complete_notified", nullable = false)
    @Builder.Default
    private boolean almostCompleteNotified = false;

    @Version
    @Column(name = "version")
    private Long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public int getRemainingQuantity() {
        return Math.max(0, lotCapacity - pooledQuantity);
    }
}
