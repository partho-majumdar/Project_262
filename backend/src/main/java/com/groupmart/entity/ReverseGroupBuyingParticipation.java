package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One customer's independent contribution of demand to a Reverse Group Buying offer.
 * <p>
 * Participants are never merged: each record keeps its own quantity, address, payment method and
 * payment reference, and turns into its own individual {@link Order} once the offer's purchasing
 * condition is unlocked. The collective demand on the offer is only an aggregate of these records.
 */
@Entity
@Table(name = "reverse_group_buying_participations", indexes = {
        @Index(name = "idx_rgb_participation_offer", columnList = "offer_id"),
        @Index(name = "idx_rgb_participation_user", columnList = "user_id"),
        @Index(name = "idx_rgb_participation_status", columnList = "status"),
        @Index(name = "idx_rgb_participation_offer_user", columnList = "offer_id, user_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReverseGroupBuyingParticipation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "offer_id", nullable = false)
    private ReverseGroupBuyingOffer offer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "quantity", nullable = false)
    private int quantity;

    /** The unlocked unit price, snapshotted so an offer edit can never change an existing demand record. */
    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "refund_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal refundAmount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private ReverseGroupBuyingParticipationStatus status = ReverseGroupBuyingParticipationStatus.PARTICIPATING;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false, length = 30)
    @Builder.Default
    private PaymentStatus paymentStatus = PaymentStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 30)
    private PaymentMethod paymentMethod;

    @Column(name = "payment_reference", length = 100)
    private String paymentReference;

    /** Set once the purchasing condition is unlocked and this participation becomes its own order. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private Order order;

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

    @Column(name = "participated_at", nullable = false)
    private LocalDateTime participatedAt;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @Column(name = "cancellation_reason", length = 500)
    private String cancellationReason;

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
