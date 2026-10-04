package com.groupmart.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * One customer's participation in a group reverse demand - their quantity, their own delivery
 * address, and eventually their own order.
 * <p>
 * The delivery address is snapshotted here rather than read from the customer's profile at
 * fulfilment time, because members of one group routinely ship to different cities and a member may
 * edit their address book the moment they join.
 * <p>
 * The unique constraint on {@code (demand_id, customer_id)} is the database-level guarantee behind
 * "one customer, at most one membership per demand" - a second join request cannot slip past a
 * service-layer check that raced.
 */
@Entity
@Table(name = "group_reverse_members", uniqueConstraints = {
        @UniqueConstraint(name = "uk_grm_demand_customer", columnNames = {"demand_id", "customer_id"})
}, indexes = {
        @Index(name = "idx_grm_demand", columnList = "demand_id"),
        @Index(name = "idx_grm_customer", columnList = "customer_id"),
        @Index(name = "idx_grm_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupReverseMember {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "demand_id", nullable = false)
    private GroupReverseDemand demand;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    @Column(name = "requested_quantity", nullable = false)
    private int requestedQuantity;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private GroupReverseMemberStatus status = GroupReverseMemberStatus.JOINED;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 30)
    private PaymentMethod paymentMethod;

    @Column(name = "payment_reference", length = 100)
    private String paymentReference;

    // ---- This member's own delivery address, snapshotted at join time ---------------------------

    @Column(name = "shipping_address_line1", nullable = false, length = 200)
    private String shippingAddressLine1;

    @Column(name = "shipping_address_line2", length = 200)
    private String shippingAddressLine2;

    @Column(name = "shipping_city", nullable = false, length = 100)
    private String shippingCity;

    @Column(name = "shipping_state", nullable = false, length = 100)
    private String shippingState;

    @Column(name = "shipping_postal_code", nullable = false, length = 30)
    private String shippingPostalCode;

    @Column(name = "shipping_country", nullable = false, length = 100)
    private String shippingCountry;

    // ---- Locked outcome ---------------------------------------------------------------------------

    /** The unit price this member pays. Set at offer selection, identical for every member. */
    @Column(name = "locked_unit_price", precision = 12, scale = 2)
    private BigDecimal lockedUnitPrice;

    @Column(name = "locked_delivery_fee", precision = 12, scale = 2)
    private BigDecimal lockedDeliveryFee;

    /** This member's share of the seller-committed delivery charge. */
    @Column(name = "delivery_fee_share", precision = 12, scale = 2)
    private BigDecimal deliveryFeeShare;

    @Column(name = "amount_paid", precision = 12, scale = 2)
    private BigDecimal amountPaid;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private Order order;

    @Column(name = "order_number", length = 40)
    private String orderNumber;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @Column(name = "cancellation_reason", length = 500)
    private String cancellationReason;

    @CreationTimestamp
    @Column(name = "joined_at", nullable = false, updatable = false)
    private LocalDateTime joinedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /** What this member pays in total: their own quantity at the locked price, plus their share of delivery. */
    public BigDecimal computeTotal() {
        if (lockedUnitPrice == null) {
            return null;
        }
        BigDecimal total = lockedUnitPrice.multiply(BigDecimal.valueOf(requestedQuantity));
        if (deliveryFeeShare != null) {
            total = total.add(deliveryFeeShare);
        }
        return total;
    }
}
