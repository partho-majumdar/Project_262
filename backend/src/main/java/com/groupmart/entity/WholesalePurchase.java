package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * The confirmed parent transaction created once a WholesalePool reaches its wholesale minimum
 * (CWP spec sections 7-8 and 23). It is the "CWP Purchase" step in
 * Offer -> Pool -> Reservations -> Purchase -> Individual Orders. Its own fields never change
 * after creation; per-customer fulfillment progress lives on the individual Orders it links to
 * via Order.wholesalePurchaseId, mirroring how Order.groupBuyGroupId links a group-buy order
 * back to its group without a hard JPA relation.
 */
@Entity
@Table(name = "wholesale_purchases", indexes = {
        @Index(name = "idx_wholesale_purchase_pool", columnList = "pool_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WholesalePurchase {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pool_id", nullable = false, unique = true)
    private WholesalePool pool;

    @Column(name = "confirmed_unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal confirmedUnitPrice;

    @Column(name = "total_confirmed_quantity", nullable = false)
    private int totalConfirmedQuantity;

    @Column(name = "participant_count", nullable = false)
    private int participantCount;

    @Column(name = "confirmed_at", nullable = false)
    private LocalDateTime confirmedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
