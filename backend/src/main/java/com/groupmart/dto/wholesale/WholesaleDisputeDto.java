package com.groupmart.dto.wholesale;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.groupmart.entity.WholesaleDisputeStatus;
import com.groupmart.entity.WholesaleDisputeType;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WholesaleDisputeDto {

    private UUID id;
    private WholesaleDisputeType type;
    private String typeLabel;
    private WholesaleDisputeStatus status;
    private String description;
    private String resolutionNote;
    private BigDecimal refundAmount;

    private UUID reservationId;
    private UUID customerId;
    private String customerName;
    private String customerEmail;

    private UUID offerId;
    private UUID poolId;
    private int lotNumber;
    private String productName;
    private String sellerStoreName;

    private int quantity;
    private BigDecimal totalAmount;
    private BigDecimal refundedSoFar;
    /** How much more can still be refunded through this dispute. */
    private BigDecimal maxRefundable;
    private UUID orderId;
    private String orderNumber;
    private String orderStatus;

    private String handledByName;
    private LocalDateTime resolvedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
