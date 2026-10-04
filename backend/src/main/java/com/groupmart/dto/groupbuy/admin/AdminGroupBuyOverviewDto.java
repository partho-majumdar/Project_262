package com.groupmart.dto.groupbuy.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminGroupBuyOverviewDto {

    private Map<String, Long> campaignsByStatus;
    private long liveCampaigns;
    private Map<String, Long> groupsByStatus;
    private long openGroups;
    private BigDecimal groupSuccessRate;
    private long activeParticipants;
    private long totalParticipations;
    private long unitsReserved;
    private long unitsCommitted;
    private long unitsSold;
    private BigDecimal grossSales;
    private BigDecimal refundsIssued;
    private BigDecimal customerSavings;
    private long openDisputes;
    private long openFraudFlags;
    private long highRiskFlags;
}
