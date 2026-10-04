package com.groupmart.dto.wholesale;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.groupmart.entity.WholesaleOfferMode;
import com.groupmart.entity.WholesaleOfferStatus;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WholesaleOfferDto {

    private UUID id;
    private UUID productId;
    private String productName;
    private String productSlug;
    private String productImageUrl;
    private BigDecimal productPrice;
    private UUID sellerStoreId;
    private String sellerStoreName;
    private String sellerStoreSlug;
    private WholesaleOfferStatus status;
    private WholesaleOfferMode mode;
    private BigDecimal wholesaleUnitPrice;
    private int wholesaleMinimumQuantity;
    private int maxAvailableQuantity;
    private int minQuantityPerCustomer;
    private int maxQuantityPerCustomer;
    private LocalDateTime reservationDeadline;
    private String expectedFulfillmentNote;
    private String deliveryConditions;
    private boolean autoReopenNewLot;
    private String rejectionReason;
    private LocalDateTime submittedAt;
    private LocalDateTime approvedAt;
    private LocalDateTime closedAt;
  private String closeCode;
  private String closeReason;
    private LocalDateTime createdAt;

    // Aggregate across this offer's pools; useful for the seller's offer list without an extra call.
    private int activeLotCount;
    private int completedLotCount;
    private int failedLotCount;
}
