package com.groupmart.dto.reverse;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.groupmart.entity.ReverseGroupBuyingOfferStatus;
import com.groupmart.entity.ReverseGroupBuyingCloseCode;
import com.groupmart.entity.ReverseTargetType;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReverseGroupBuyingOfferDto {

    private UUID id;
    private UUID productId;
    private String productName;
    private String productSlug;
    private String productImageUrl;
    private BigDecimal productPrice;
    private UUID sellerStoreId;
    private String sellerStoreName;
    private String sellerStoreSlug;

    private ReverseGroupBuyingOfferStatus status;
    private String description;

    private BigDecimal basePrice;
    private int availableQuantity;
    private ReverseTargetType targetType;
    private String targetTypeLabel;
    private BigDecimal targetValue;
    private int targetQuantity;
    private BigDecimal unlockedUnitPrice;
    private int minQuantityPerCustomer;
    private int maxQuantityPerCustomer;
    private LocalDateTime participationDeadline;

    private int currentDemand;
    private int remainingDemand;
    private int remainingToTarget;
    private int participantCount;
    private int targetProgressPercent;
    private boolean targetReached;
    private boolean acceptsDemand;

    private LocalDateTime targetReachedAt;
    private LocalDateTime activatedAt;
    private LocalDateTime closedAt;
    private ReverseGroupBuyingCloseCode closeCode;
    private String closeReasonLabel;
    private String closeNote;
    private LocalDateTime createdAt;
}
