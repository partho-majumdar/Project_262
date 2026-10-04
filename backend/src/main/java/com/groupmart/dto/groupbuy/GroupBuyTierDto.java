package com.groupmart.dto.groupbuy;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuyTierDto {

    private int minParticipants;
    private BigDecimal unitPrice;
    private BigDecimal discountPercent;
    private BigDecimal savingsPerUnit;
    private boolean unlocked;
}
