package com.groupmart.dto.groupbuy;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuySavingsEntryDto {

    private UUID groupId;
    private UUID campaignId;
    private String productName;
    private String productImageUrl;
    private int quantity;
    private BigDecimal basePrice;
    private BigDecimal paidUnitPrice;
    private BigDecimal savings;
    private String orderNumber;
    private LocalDateTime completedAt;
}
