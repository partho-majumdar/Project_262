package com.groupmart.dto.groupbuy;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.groupmart.entity.GroupBuyParticipantStatus;
import com.groupmart.entity.PaymentMethod;
import com.groupmart.entity.PaymentStatus;

/** The current viewer's own participation in a group, including payment and order details. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuyMembershipDto {

    private UUID participantId;
    private UUID userId;
    private int quantity;
    private GroupBuyParticipantStatus status;
    private BigDecimal unitPriceAtJoin;
    private BigDecimal amountPaid;
    private BigDecimal effectiveUnitPrice;
    private BigDecimal finalUnitPrice;
    private BigDecimal refundAmount;
    private BigDecimal savings;
    private PaymentStatus paymentStatus;
    private PaymentMethod paymentMethod;
    private String paymentReference;
    private String orderNumber;
    private String orderStatus;
    private String shippingAddress;
    private LocalDateTime joinedAt;
    private LocalDateTime leftAt;
}
