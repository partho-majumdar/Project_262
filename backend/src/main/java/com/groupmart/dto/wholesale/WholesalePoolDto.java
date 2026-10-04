package com.groupmart.dto.wholesale;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.groupmart.entity.WholesalePoolStatus;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WholesalePoolDto {

    private UUID id;
    private UUID offerId;
    private UUID productId;
    private String productName;
    private String productImageUrl;
    private UUID sellerStoreId;
    private String sellerStoreName;
    private int lotNumber;
    private WholesalePoolStatus status;
    private BigDecimal wholesaleUnitPrice;
    private int wholesaleMinimumQuantity;
    private int lotCapacity;
    private int pooledQuantity;
    private int remainingQuantity;
    private int participantCount;
    private int minQuantityPerCustomer;
    private int maxQuantityPerCustomer;
    private LocalDateTime deadline;
    private LocalDateTime completedAt;
    private LocalDateTime closedAt;
  private String closeCode;
  private String closeReasonLabel;
  /**
   * Fulfilment progress derived from the lot's own orders rather than stored, so a lot can never
   * claim to be processing after every order in it has been delivered. One of AWAITING_FULFILMENT,
   * PARTIALLY_FULFILLED or FULFILLED; null while the lot has produced no orders yet.
   */
  private String fulfilmentStatus;
  private int orderCount;
  private int deliveredOrderCount;
  private boolean allOrdersDelivered;
  private LocalDateTime createdAt;
}
