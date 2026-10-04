package com.groupmart.dto.auction;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.groupmart.entity.AuctionPricingRule;
import com.groupmart.entity.GroupBuyingAuctionCloseCode;
import com.groupmart.entity.GroupBuyingAuctionStatus;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuyingAuctionDto {

    private UUID id;
    private UUID productId;
    private String productName;
    private String productSlug;
    private String productImageUrl;
    private BigDecimal productPrice;
    private UUID sellerStoreId;
    private String sellerStoreName;
    private String sellerStoreSlug;

    private GroupBuyingAuctionStatus status;
    private String description;

    private BigDecimal startingPrice;
    private BigDecimal minimumSellerUnitPrice;
    private int availableQuantity;
    private int minimumCollectiveQuantity;
    private int minQuantityPerCustomer;
    private int maxQuantityPerCustomer;
    private LocalDateTime startsAt;
    private LocalDateTime endsAt;

    private AuctionPricingRule pricingRule;
    private BigDecimal discountPercent;
    private List<AuctionTierDto> tiers;

    private int collectiveQuantity;
    private int remainingQuantity;
    private int remainingToMinimum;
    private int participantCount;

    /** Null until the auction is finalized. */
    private BigDecimal finalUnitPrice;
    private boolean finalized;
    private LocalDateTime finalizedAt;

    /**
     * The unit price the current collective quantity would clear at right now. Display-only
     * projection; the server always recalculates and locks the real price at finalization.
     */
    private BigDecimal projectedUnitPrice;

    private GroupBuyingAuctionCloseCode closeCode;
    private String closeReasonLabel;
    private String closeNote;
    private LocalDateTime createdAt;
}
