package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * An eBay-style proxy-bidding auction for a lot of one seller's product.
 * <p>
 * Customers submit a <b>private maximum bid</b>. The system bids on their behalf against competing
 * maximums, so {@link #currentPrice} is the price the leading bidder is actually committed to -
 * usually far below their private maximum, and never derived from it. The maximum itself is only
 * ever read from {@link AuctionBid#getMaximumBid()} and is never mapped into a public DTO.
 * <p>
 * Independent of {@link WholesalePool} (CWP), {@link GroupBuyCampaign} (group buy),
 * {@link ReverseGroupBuyingOffer} and {@link GroupBuyingAuction} (collective pricing): the price
 * here comes from competing maximum bids under {@link #minimumBidIncrement}, never from a wholesale
 * minimum, a demand target or a quantity ladder.
 */
@Entity
@Table(name = "auctions", indexes = {
        @Index(name = "idx_auction_product", columnList = "product_id"),
        @Index(name = "idx_auction_seller_store", columnList = "seller_store_id"),
        @Index(name = "idx_auction_status", columnList = "status"),
        @Index(name = "idx_auction_ends_at", columnList = "ends_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Auction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_store_id", nullable = false)
    private SellerStore sellerStore;

    @Column(name = "description", length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private AuctionStatus status = AuctionStatus.DRAFT;

    /** Opening price shown before anybody bids, and the price a lone bidder is committed to. */
    @Column(name = "starting_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal startingPrice;

    /** Seller-configured. A competing maximum must beat the leader by at least this much. */
    @Column(name = "minimum_bid_increment", nullable = false, precision = 12, scale = 2)
    private BigDecimal minimumBidIncrement;

    /** The public price. Never equals a bidder's maximum unless that bidder is the only one. */
    @Column(name = "current_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal currentPrice;

    /** Private to the owning seller and admins: never exposed to bidders. */
    @Column(name = "reserve_price", precision = 12, scale = 2)
    private BigDecimal reservePrice;

    /** Units in the lot. Taken out of sellable stock when the auction is created. */
    @Column(name = "quantity", nullable = false)
    private int quantity;

    @Column(name = "bid_count", nullable = false)
    @Builder.Default
    private int bidCount = 0;

    /** Number of distinct bidders; always less than or equal to {@link #bidCount}. */
    @Column(name = "bidder_count", nullable = false)
    @Builder.Default
    private int bidderCount = 0;

    @Column(name = "starts_at", nullable = false)
    private LocalDateTime startsAt;

    @Column(name = "ends_at", nullable = false)
    private LocalDateTime endsAt;

    /** The bidder the proxy engine currently backs. Their maximum stays private. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "leading_bidder_id")
    private User leadingBidder;

    @Column(name = "leading_bid_id")
    private UUID leadingBidId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "winner_id")
    private User winner;

    @Column(name = "winning_bid_id")
    private UUID winningBidId;

    /** The price the winner actually pays: the second-highest maximum plus one increment, capped. */
    @Column(name = "final_price", precision = 12, scale = 2)
    private BigDecimal finalPrice;

    /** The order created for the winner. Backed by a unique constraint on {@code orders.auction_id}. */
    @Column(name = "winner_order_id")
    private UUID winnerOrderId;

    @Enumerated(EnumType.STRING)
    @Column(name = "close_code", length = 40)
    private AuctionCloseCode closeCode;

    @Column(name = "close_note", length = 500)
    private String closeNote;

    /** Whether the lot's units are still held out of sellable stock. Guards double releases. */
    @Column(name = "inventory_reserved", nullable = false)
    @Builder.Default
    private boolean inventoryReserved = false;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    /** Who closed it: the seller for an early close, null for the scheduled sweep. */
    @Column(name = "closed_by_user_id")
    private UUID closedByUserId;

    @Version
    @Column(name = "version")
    private Long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public boolean hasReserve() {
        return reservePrice != null;
    }

    /** Public-safe: reveals only whether the reserve is configured and whether it is met. */
    public boolean isReserveMet() {
        return reservePrice == null || currentPrice.compareTo(reservePrice) >= 0;
    }

    /** The least a new bidder may offer, from the server's point of view. */
    public BigDecimal minimumNextBid() {
        return currentPrice.add(minimumBidIncrement);
    }

    public boolean acceptsBidsAt(LocalDateTime now) {
        return status.acceptsBids() && !now.isBefore(startsAt) && now.isBefore(endsAt);
    }
}
