package com.groupmart.dto.groupbuy;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.groupmart.entity.GroupBuyCampaignStatus;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuyCampaignDto {

    private UUID id;
    private UUID productId;
    private String productName;
    private String productSlug;
    private String productImageUrl;
    private List<String> productImageUrls;
    private String categoryName;
    private String categorySlug;
    private int productStock;
    private UUID sellerStoreId;
    private String sellerStoreName;
    private String sellerStoreSlug;
    private String title;
    private String description;
    private GroupBuyCampaignStatus status;
    private BigDecimal basePrice;
    private BigDecimal lowestPrice;
    private BigDecimal maxDiscountPercent;
    private int minParticipants;
    private int maxParticipants;
    private int maxQuantityPerUser;
    private int reservedQuantity;
    private int availableQuantity;
    private int soldQuantity;
    private int committedQuantity;
    private boolean inventoryReserved;
    private boolean inventoryReleased;
    private int groupDurationHours;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private List<GroupBuyTierDto> tiers;
    private long openGroupCount;
    private long successfulGroupCount;
    private long failedGroupCount;
    private long totalParticipants;
    private String rejectionReason;
    private String closingNote;
    private String closeCode;
    private String closeReasonLabel;
    private LocalDateTime submittedAt;
    private LocalDateTime approvedAt;
    private LocalDateTime closedAt;
    private LocalDateTime createdAt;
}
