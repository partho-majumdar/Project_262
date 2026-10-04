package com.groupmart.dto.reverse;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.groupmart.entity.PaymentMethod;
import com.groupmart.entity.PaymentStatus;
import com.groupmart.entity.ReverseGroupBuyingParticipationStatus;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReverseGroupBuyingParticipationDto {

    private UUID id;
    private UUID offerId;

    // Product context, so the customer's dashboard needs no second call.
    private UUID productId;
    private String productName;
    private String productImageUrl;
    private BigDecimal basePrice;

    private int quantity;
    private BigDecimal unitPrice;
    private BigDecimal totalAmount;
    private BigDecimal refundAmount;
    private ReverseGroupBuyingParticipationStatus status;
    private PaymentStatus paymentStatus;
    private PaymentMethod paymentMethod;

    private UUID orderId;
    private String orderNumber;
    private String orderStatus;
    private String orderPaymentStatus;

    // Live offer progress, for the customer dashboard.
    private int offerCurrentDemand;
    private int offerTargetQuantity;
    private int offerParticipantCount;
    private int offerProgressPercent;
    private boolean offerTargetReached;
    private String offerStatus;
    private BigDecimal offerUnlockedUnitPrice;
    private LocalDateTime offerDeadline;

    private LocalDateTime participatedAt;
    private LocalDateTime cancelledAt;
    private LocalDateTime createdAt;
}
