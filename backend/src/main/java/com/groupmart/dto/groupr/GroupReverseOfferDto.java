package com.groupmart.dto.groupr;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.groupmart.entity.GroupReverseOfferStatus;

/**
 * A seller's competing offer, as the group leader sees it on the comparison screen.
 * <p>
 * Factual terms only, and deliberately unranked: the leader chooses, and the system never
 * pre-selects or reorders a winner. {@code rank} is presentational only and is derived from unit
 * price for the leader's convenience, never used to decide anything.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupReverseOfferDto {

    private UUID id;
    private UUID demandId;
    private String productName;
    private int requiredQuantity;

    private UUID sellerStoreId;
    private String sellerStoreName;
    private String sellerStoreSlug;
    /** The store's own rating, if it has one - factual context for the leader, not a ranking. */
    private Double sellerRating;

    private BigDecimal unitPrice;
    private int offeredQuantity;
    private BigDecimal deliveryFee;
    /** offeredQuantity x unitPrice + deliveryFee: what the whole group would pay this seller. */
    private BigDecimal groupTotal;
    /** groupTotal divided across the group, purely so the leader can compare sellers at a glance. */
    private BigDecimal effectiveUnitPriceIncludingDelivery;

    private int estimatedDeliveryDays;
    private Integer warrantyMonths;
    private String message;

    private GroupReverseOfferStatus status;
    private String statusLabel;
    private LocalDateTime offerExpiry;
    private boolean selectable;
    /** True for the offer the leader already chose. */
    private boolean accepted;
    /** True when the offer is below the creator's stated target price. */
    private boolean meetsTargetPrice;

    private LocalDateTime createdAt;
}
