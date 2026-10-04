package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * One row of an auction's {@link AuctionPricingRule#COLLECTIVE_QUANTITY_TIERS} configuration:
 * "from {@code minimumQuantity} collectively bid units, the unit price is {@code unitPrice}".
 * <p>
 * The tiers are seller configuration, stored per auction so a price ladder is never hardcoded in
 * application logic. {@code AuctionPricingService} picks the highest tier the collective quantity
 * reaches.
 */
@Entity
@Table(name = "group_buying_auction_tiers", indexes = {
        @Index(name = "idx_auction_tier_auction", columnList = "auction_id"),
        @Index(name = "idx_auction_tier_order", columnList = "auction_id, min_quantity")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupBuyingAuctionTier {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "auction_id", nullable = false)
    private GroupBuyingAuction auction;

    /** Inclusive lower bound of collective quantity this tier applies from. */
    @Column(name = "min_quantity", nullable = false)
    private int minQuantity;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;
}
