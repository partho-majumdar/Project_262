package com.groupmart.dto.groupbuy;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.groupmart.entity.GroupBuyDisputeStatus;
import com.groupmart.entity.GroupBuyDisputeType;
import com.groupmart.entity.GroupBuyGroupStatus;
import com.groupmart.entity.GroupBuyParticipantStatus;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuyDisputeDto {

    private UUID id;
    private GroupBuyDisputeType type;
    private String typeLabel;
    private GroupBuyDisputeStatus status;
    private String description;
    private String resolutionNote;
    private BigDecimal refundAmount;

    private UUID participantId;
    private UUID customerId;
    private String customerName;
    private String customerEmail;

    private UUID campaignId;
    private String campaignTitle;
    private String productName;
    private String sellerStoreName;
    private UUID groupId;
    private String inviteCode;
    private GroupBuyGroupStatus groupStatus;

    private GroupBuyParticipantStatus participantStatus;
    private int quantity;
    private BigDecimal amountPaid;
    private BigDecimal refundedSoFar;
    /** How much more can still be refunded through this dispute. */
    private BigDecimal maxRefundable;
    private String orderNumber;
    private String orderStatus;

    private String handledByName;
    private LocalDateTime resolvedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
