package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "group_buy_participants",
        uniqueConstraints = @UniqueConstraint(name = "uk_gb_participant_group_user", columnNames = {"group_id", "user_id"}),
        indexes = {
                @Index(name = "idx_gb_participant_user", columnList = "user_id"),
                @Index(name = "idx_gb_participant_inviter", columnList = "invited_by_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupBuyParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    // Named buyGroup because "group" is a reserved word in JPQL.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private GroupBuyGroup buyGroup;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invited_by_id")
    private User invitedBy;

    @Column(name = "quantity", nullable = false)
    private int quantity;

    @Column(name = "unit_price_at_join", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPriceAtJoin;

    @Column(name = "amount_paid", nullable = false, precision = 12, scale = 2)
    private BigDecimal amountPaid;

    @Column(name = "final_unit_price", precision = 12, scale = 2)
    private BigDecimal finalUnitPrice;

    @Column(name = "refund_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal refundAmount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private GroupBuyParticipantStatus status = GroupBuyParticipantStatus.JOINED;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false, length = 30)
    @Builder.Default
    private PaymentStatus paymentStatus = PaymentStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 30)
    private PaymentMethod paymentMethod;

    @Column(name = "payment_reference", length = 100)
    private String paymentReference;

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

    @Column(name = "joined_at", nullable = false)
    private LocalDateTime joinedAt;

    @Column(name = "left_at")
    private LocalDateTime leftAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
