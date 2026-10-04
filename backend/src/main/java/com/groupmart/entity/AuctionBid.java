package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One customer's bid in a proxy-bidding {@link Auction}.
 * <p>
 * At most one row per (auction, bidder) - enforced by a unique constraint - so raising your
 * maximum updates this row instead of stacking a second one.
 * <p>
 * {@link #maximumBid} is the customer's private ceiling. It is written here, compared here, and
 * never leaves the server: no public DTO carries it, and no notification quotes it.
 * {@link #effectiveBid} is the public amount actually committed at the moment of placement, which
 * is what the public bid history shows.
 */
@Entity
@Table(name = "auction_bids",
        uniqueConstraints = @UniqueConstraint(name = "uk_auction_bid_auction_bidder",
                columnNames = {"auction_id", "bidder_id"}),
        indexes = {
                @Index(name = "idx_auction_bid_auction", columnList = "auction_id"),
                @Index(name = "idx_auction_bid_bidder", columnList = "bidder_id"),
                @Index(name = "idx_auction_bid_status", columnList = "status")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuctionBid {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "auction_id", nullable = false)
    private Auction auction;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bidder_id", nullable = false)
    private User bidder;

    /** Private ceiling. Never serialised into a public response. */
    @Column(name = "maximum_bid", nullable = false, precision = 12, scale = 2)
    private BigDecimal maximumBid;

    /** Public amount committed when this bid was placed or last raised. */
    @Column(name = "effective_bid", nullable = false, precision = 12, scale = 2)
    private BigDecimal effectiveBid;

    /** Units this bid is for. Must be within the lot and not exceed what the bidder won. */
    @Column(name = "quantity", nullable = false)
    private int quantity;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private AuctionBidStatus status = AuctionBidStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false, length = 30)
    @Builder.Default
    private PaymentStatus paymentStatus = PaymentStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 30)
    private PaymentMethod paymentMethod;

    @Column(name = "payment_reference", length = 100)
    private String paymentReference;

    /** What the winner actually paid, set once the auction closes. */
    @Column(name = "amount_paid", precision = 12, scale = 2)
    private BigDecimal amountPaid;

    @Column(name = "refund_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal refundAmount = BigDecimal.ZERO;

    /** Set when this bid wins, so the seller and the customer can trace the order back to the bid. */
    @Column(name = "order_id")
    private UUID orderId;

    // Shipping snapshot taken at bid time, so the winning order is built even if the customer
    // later edits or deletes their address book entry.
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

    /**
     * First moment this bid existed. Used as the deterministic tie-break when two bidders submit the
     * same maximum: the earlier bid wins the tie.
     */
    @Column(name = "placed_at", nullable = false)
    private LocalDateTime placedAt;

    /**
     * When the customer last raised the ceiling on this bid; null while it has never been raised.
     * <p>
     * Distinct from {@code updatedAt} on purpose. The auction re-saves every bid row whenever the
     * ranking is recomputed, so {@code updatedAt} moves for reasons that have nothing to do with the
     * customer acting, and cannot answer "did this bidder push?".
     */
    @Column(name = "ceiling_raised_at")
    private LocalDateTime ceilingRaisedAt;

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

    public boolean isEligible() {
        return status.isEligible();
    }
}
