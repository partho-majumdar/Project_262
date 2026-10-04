package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One customer's independent bid in a Group Buying Auction: how many units, and the maximum unit
 * price they are willing to pay for them.
 * <p>
 * The auction mechanism sets a single clearing price from the collective quantity. A bid whose
 * {@code maxUnitPrice} is below that locked price is not honoured (OUTBID, refunded); a bid at or
 * above it becomes an individual order priced at the final unit price. No other customer's private
 * information is exposed - bids are only ever shown publicly as quantity and maximum price.
 */
@Entity
@Table(name = "group_buying_auction_participations", indexes = {
        @Index(name = "idx_auction_participation_auction", columnList = "auction_id"),
        @Index(name = "idx_auction_participation_user", columnList = "user_id"),
        @Index(name = "idx_auction_participation_status", columnList = "status"),
        @Index(name = "idx_auction_participation_auction_user", columnList = "auction_id, user_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupBuyingAuctionParticipation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "auction_id", nullable = false)
    private GroupBuyingAuction auction;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "quantity", nullable = false)
    private int quantity;

    /** The bid: the most this customer will pay per unit. Compared against the locked final price. */
    @Column(name = "max_unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal maxUnitPrice;

    /** What the customer was charged at the locked clearing price; equals maxUnitPrice * quantity for WON bids. */
    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "refund_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal refundAmount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private AuctionParticipationStatus status = AuctionParticipationStatus.BID_PLACED;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false, length = 30)
    @Builder.Default
    private PaymentStatus paymentStatus = PaymentStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 30)
    private PaymentMethod paymentMethod;

    @Column(name = "payment_reference", length = 100)
    private String paymentReference;

    /** Set once the bid wins and becomes its own individual order. */
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

    @Column(name = "bid_at", nullable = false)
    private LocalDateTime bidAt;

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
