package com.groupmart.dto.groupbuy;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuyStatsDto {

    private long activeGroups;
    private long successfulGroups;
    private long failedGroups;
    private long startedGroups;
    private long leftGroups;
    private BigDecimal totalSavings;
    private BigDecimal totalSpent;
    private BigDecimal totalRefunded;
    private long successfulInvites;
    private List<GroupBuySavingsEntryDto> savingsHistory;

    private long totalParticipations;
    /** Successful groups as a share of groups that closed with the shopper still in them. */
    private BigDecimal successRate;
    private long unitsBought;
    private BigDecimal regularPriceTotal;
    private BigDecimal averageDiscountPercent;
    private GroupBuySavingsEntryDto biggestSaving;
    /** Last 12 months, oldest first, including months without purchases. */
    private List<MonthRow> monthly;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MonthRow {
        /** yyyy-MM */
        private String month;
        private long groups;
        private BigDecimal spent;
        private BigDecimal savings;
        private BigDecimal cumulativeSavings;
    }
}
