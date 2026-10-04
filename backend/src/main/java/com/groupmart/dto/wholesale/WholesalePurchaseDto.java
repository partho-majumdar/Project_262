package com.groupmart.dto.wholesale;

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
public class WholesalePurchaseDto {

    private UUID id;
    private UUID poolId;
    private UUID offerId;
    private UUID productId;
    private String productName;
    private BigDecimal confirmedUnitPrice;
    private int totalConfirmedQuantity;
    private int participantCount;
    private LocalDateTime confirmedAt;
}
