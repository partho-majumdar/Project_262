package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A seller-configured Group Buying Auction over one product.
 * <p>
 * The seller configures the mechanism: the starting price, the quantity limits, the auction window,
 * and the {@link AuctionPricingRule} the final price is derived from. This is a standalone
 * purchasing mechanism: it has no pool, no reservation and no wholesale minimum, and the final unit
 * price is produced only by {@code AuctionPricingService} from the auction's own configuration.
 * <p>
 * Concurrency: {@code collectiveQuantity} and {@code participantCount} are aggregates maintained
 * inside the bidding transaction under a PESSIMISTIC_WRITE row lock plus an {@code @Version}
 * column, so concurrent bids can never exceed {@code availableQuantity} nor oversell stock.
 */
@Entity
@Table(name = "group_buying_auctions", indexes = {
        @Index(name = "idx_auction_status", columnList = "status"),
        @Index(name = "idx_auction_store", columnList = "seller_store_id"),
        @Index(name = "idx_auction_product", columnList = "product_id"),
        @Index(name = "idx_auction_window", columnList = "status, starts_at, ends_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupBuyingAuction {

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

    @Column(name = "description", length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private GroupBuyingAuctionStatus status = GroupBuyingAuctionStatus.DRAFT;

    /** Price ceiling for a single unit before any collective discount is applied. */
    @Column(name = "starting_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal startingPrice;

    /** Seller's optional floor: the final unit price will never be pushed below this. */
    @Column(name = "minimum_seller_unit_price", precision = 12, scale = 2)
    private BigDecimal minimumSellerUnitPrice;

    /** Maximum collective quantity the auction can absorb. */
    @Column(name = "available_quantity", nullable = false)
    private int availableQuantity;

    /** Minimum collective quantity for the auction to succeed; below this it fails and refunds. */
    @Column(name = "minimum_collective_quantity", nullable = false)
    private int minimumCollectiveQuantity;

    @Column(name = "min_quantity_per_customer", nullable = false)
    @Builder.Default
    private int minQuantityPerCustomer = 1;

    @Column(name = "max_quantity_per_customer", nullable = false)
    private int maxQuantityPerCustomer;

    @Column(name = "starts_at", nullable = false)
    private LocalDateTime startsAt;

    @Column(name = "ends_at", nullable = false)
    private LocalDateTime endsAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "pricing_rule", nullable = false, length = 40)
    private AuctionPricingRule pricingRule;

    /** Only meaningful for COLLECTIVE_QUANTITY_DISCOUNT. */
    @Column(name = "discount_percent", precision = 5, scale = 2)
    private BigDecimal discountPercent;

    /** Sum of quantities across BID_PLACED participations. */
    @Column(name = "collective_quantity", nullable = false)
    @Builder.Default
    private int collectiveQuantity = 0;

    @Column(name = "participant_count", nullable = false)
    @Builder.Default
    private int participantCount = 0;

    /** The locked clearing price. Written once at finalization and never recalculated. */
    @Column(name = "final_unit_price", precision = 12, scale = 2)
    private BigDecimal finalUnitPrice;

    @Column(name = "finalized_at")
    private LocalDateTime finalizedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "close_code", length = 40)
    private GroupBuyingAuctionCloseCode closeCode;

    @Column(name = "close_note", length = 500)
    private String closeNote;

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
        return Math.max(0, availableQuantity - collectiveQuantity);
    }

    public int getRemainingToMinimum() {
        return Math.max(0, minimumCollectiveQuantity - collectiveQuantity);
    }
}
