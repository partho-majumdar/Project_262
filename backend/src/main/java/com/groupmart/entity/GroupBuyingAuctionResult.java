package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * The locked outcome of a Group Buying Auction, written exactly once when the auction is finalized.
 * <p>
 * The final unit price is stored here and on {@link GroupBuyingAuction#finalUnitPrice} and is never
 * recalculated, so later bids, cancellations or administrative actions cannot change a finalized
 * auction's result or the orders generated from it.
 * <p>
 * This is the parent purchasing event for the individual orders: each generated order carries
 * {@code Order.orderType = GROUP_BUYING_AUCTION} and
 * {@code Order.groupBuyingAuctionId = auction id}.
 */
@Entity
@Table(name = "group_buying_auction_results", indexes = {
        @Index(name = "idx_auction_result_auction", columnList = "auction_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupBuyingAuctionResult {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "auction_id", nullable = false, unique = true)
    private GroupBuyingAuction auction;

    @Enumerated(EnumType.STRING)
    @Column(name = "pricing_rule", nullable = false, length = 40)
    private AuctionPricingRule pricingRule;

    /** The locked clearing price every winning customer pays per unit. */
    @Column(name = "final_unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal finalUnitPrice;

    @Column(name = "starting_price_at_finalization", nullable = false, precision = 12, scale = 2)
    private BigDecimal startingPriceAtFinalization;

    /** Collective quantity the clearing price was derived from. */
    @Column(name = "collective_quantity", nullable = false)
    private int collectiveQuantity;

    @Column(name = "bidder_count", nullable = false)
    private int bidderCount;

    /** Bids whose maximum unit price reached the clearing price and became orders. */
    @Column(name = "winning_bid_count", nullable = false)
    private int winningBidCount;

    @Column(name = "outbid_count", nullable = false)
    private int outbidCount;

    /**
     * Units actually sold: the sum of the winning bids' quantities.
     * <p>
     * Distinct from {@link #collectiveQuantity}, which also counts the outbid quantities. That
     * difference is the whole point of the mechanism - a bidder who misses out still pushed the
     * collective total that set the price, but their units are not sold.
     */
    @Column(name = "winning_quantity", nullable = false)
    @Builder.Default
    private int winningQuantity = 0;

    /** Units lost by the outbid bidders, and returned to sellable stock. */
    @Column(name = "outbid_quantity", nullable = false)
    @Builder.Default
    private int outbidQuantity = 0;

    /**
     * Revenue from the winning orders only: {@code winningQuantity x finalUnitPrice}.
     * <p>
     * Outbid quantity is never counted as sales, so this is what the seller actually earned from
     * the auction.
     */
    @Column(name = "total_successful_sales", nullable = false, precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal totalSuccessfulSales = BigDecimal.ZERO;

    /** Seller floor applied to the calculated price, when configured. */
    @Column(name = "minimum_seller_unit_price", precision = 12, scale = 2)
    private BigDecimal minimumSellerUnitPrice;

    @Column(name = "finalized_at", nullable = false)
    private LocalDateTime finalizedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "finalized_by_user_id")
    private User finalizedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
