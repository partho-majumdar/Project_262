package com.groupmart.dto.groupbuy.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.groupmart.entity.GroupBuyGroupStatus;
import com.groupmart.entity.GroupBuyParticipantStatus;
import com.groupmart.entity.PaymentMethod;
import com.groupmart.entity.PaymentStatus;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminGroupBuyParticipantDto {

    private UUID id;
    private UUID userId;
    private String customerName;
    private String customerEmail;
    private LocalDateTime accountCreatedAt;
    private boolean accountEnabled;

    private UUID campaignId;
    private String campaignTitle;
    private String productName;
    private String sellerStoreName;
    private UUID groupId;
    private String inviteCode;
    private GroupBuyGroupStatus groupStatus;
    private boolean leader;
    private String invitedByName;
    private String invitedByEmail;

    private int quantity;
    private BigDecimal unitPriceAtJoin;
    private BigDecimal amountPaid;
    private BigDecimal finalUnitPrice;
    private BigDecimal refundAmount;
    private BigDecimal netPaid;
    private GroupBuyParticipantStatus status;
    private PaymentStatus paymentStatus;
    private PaymentMethod paymentMethod;
    private String paymentReference;

    private UUID orderId;
    private String orderNumber;
    private String orderStatus;
    private BigDecimal orderTotal;
    private LocalDateTime orderCreatedAt;

    private String shippingAddress;
    private LocalDateTime joinedAt;
    private LocalDateTime leftAt;
}
