package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A customer's complaint about one wholesale reservation's converted order, handled by an
 * administrator (CWP spec section 21). Disputes are scoped to a single reservation - one
 * customer's dispute never affects any other participant in the same pool.
 */
@Entity
@Table(name = "wholesale_disputes", indexes = {
        @Index(name = "idx_wholesale_dispute_status", columnList = "status"),
        @Index(name = "idx_wholesale_dispute_reservation", columnList = "reservation_id"),
        @Index(name = "idx_wholesale_dispute_raised_by", columnList = "raised_by_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WholesaleDispute {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reservation_id", nullable = false)
    private WholesaleReservation reservation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "raised_by_id", nullable = false)
    private User raisedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 40)
    private WholesaleDisputeType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private WholesaleDisputeStatus status = WholesaleDisputeStatus.OPEN;

    @Column(name = "description", nullable = false, length = 2000)
    private String description;

    @Column(name = "resolution_note", length = 1000)
    private String resolutionNote;

    @Column(name = "refund_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal refundAmount = BigDecimal.ZERO;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "handled_by_id")
    private User handledBy;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Version
    @Column(name = "version")
    private Long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
