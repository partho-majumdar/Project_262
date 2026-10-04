package com.groupmart.dto.groupbuy.analytics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Group buy analytics for the whole platform or one seller store.
 * Money and outcome figures cover groups that closed in the period; join figures cover joins made in the period.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuyAnalyticsDto {

    public static final String PLATFORM = "PLATFORM";
    public static final String SELLER = "SELLER";

    private String scope;
    private UUID storeId;
    private String storeName;
    /** Window length in days; 0 means all time. */
    private int days;
    private LocalDateTime since;
    private LocalDateTime generatedAt;

    private Summary summary;
    private Map<String, Long> campaignOutcomes;
    private List<ReasonRow> failureReasons;
    private List<ReasonRow> campaignCancellations;
    private List<DayRow> daily;
    private List<DiscountBandRow> discountBands;
    private List<ProductRow> products;
    private List<CampaignRow> campaigns;
    /** Platform scope only. */
    private List<SellerRow> sellers;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Summary {
        private long groupsStarted;
        private long groupsClosed;
        private long groupsSucceeded;
        private long groupsFailed;
        private long groupsCancelled;
        private BigDecimal successRate;
        private BigDecimal failureRate;

        private long participantsJoined;
        private long uniqueCustomers;
        private long repeatCustomers;
        private long inviteJoins;
        private BigDecimal inviteShare;
        /** Everyone who was in a group that closed in the period, including members who left. */
        private long closedGroupMembers;
        private long convertedMembers;
        private BigDecimal conversionRate;
        private BigDecimal averageGroupSize;
        private BigDecimal averageClosedGroupSize;
        private long unitsSold;

        /** What members paid when they joined groups that closed in the period. */
        private BigDecimal expectedRevenue;
        /** What was kept after every refund. */
        private BigDecimal revenue;
        private BigDecimal lostToFailedGroups;
        private BigDecimal lostToLeaves;
        private BigDecimal priceDropRefunds;
        private BigDecimal disputeRefunds;
        private BigDecimal refunds;
        private BigDecimal realizationRate;

        private BigDecimal regularPriceValue;
        private BigDecimal customerSavings;
        private BigDecimal averageDiscountPercent;

        /** Null when no campaign in scope has a unit cost. */
        private BigDecimal cost;
        private BigDecimal profit;
        private BigDecimal marginPercent;
        /** Share of revenue that comes from campaigns with a unit cost. */
        private BigDecimal costCoverage;

        private long liveCampaigns;
        private long openGroups;
        private long activeParticipants;
        private long unitsReservedHeld;
        private long unitsCommittedHeld;
        private long unitsAvailableHeld;
        /** Units sold as a share of units reserved, for campaigns that ended in the period. */
        private BigDecimal sellThroughRate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReasonRow {
        private String code;
        private String label;
        private long count;
        private long participantsAffected;
        private BigDecimal refunded;
        private BigDecimal percent;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DayRow {
        private LocalDate date;
        private long groupsStarted;
        private long groupsSucceeded;
        private long groupsFailed;
        private long participantsJoined;
        private long cumulativeParticipants;
        private BigDecimal revenue;
        private BigDecimal refunds;
        private BigDecimal savings;
    }

    /** Campaigns grouped by the biggest discount their price ladder advertises. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DiscountBandRow {
        private String band;
        private String label;
        private int minPercent;
        private long campaigns;
        private long groupsClosed;
        private long groupsSucceeded;
        private BigDecimal successRate;
        private BigDecimal averageGroupSize;
        private long unitsSold;
        private BigDecimal revenue;
        private BigDecimal customerSavings;
        private boolean best;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProductRow {
        private UUID productId;
        private String productName;
        private String productImageUrl;
        private String storeName;
        private long campaigns;
        private long joins;
        private long groupsSucceeded;
        private long groupsFailed;
        private BigDecimal successRate;
        private long unitsSold;
        private BigDecimal revenue;
        private BigDecimal customerSavings;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CampaignRow {
        private UUID campaignId;
        private String title;
        private UUID productId;
        private String productName;
        private UUID storeId;
        private String storeName;
        private String status;
        private BigDecimal basePrice;
        private BigDecimal lowestPrice;
        private BigDecimal maxDiscountPercent;
        private int minParticipants;
        private int maxParticipants;
        private LocalDateTime startAt;
        private LocalDateTime endAt;

        private long groupsStarted;
        private long groupsSucceeded;
        private long groupsFailed;
        private BigDecimal successRate;
        private long joins;
        private long closedGroupMembers;
        private long convertedMembers;
        private BigDecimal conversionRate;
        private BigDecimal averageGroupSize;

        private long unitsSold;
        private int reservedQuantity;
        /** Lifetime units sold as a share of units reserved. */
        private BigDecimal sellThroughRate;

        private BigDecimal expectedRevenue;
        private BigDecimal revenue;
        private BigDecimal refunds;
        private BigDecimal customerSavings;
        private BigDecimal unitCost;
        private BigDecimal cost;
        private BigDecimal profit;
        private BigDecimal marginPercent;

        private String topFailureReason;
        private List<TierRow> tiers;
    }

    /** How many successful groups in the period ended on each tier of a campaign's ladder. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TierRow {
        private int minParticipants;
        private BigDecimal unitPrice;
        private BigDecimal discountPercent;
        private long groupsEndedHere;
        private boolean mostReached;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SellerRow {
        private int rank;
        private UUID storeId;
        private String storeName;
        private long campaigns;
        private long liveCampaigns;
        private long groupsSucceeded;
        private long groupsFailed;
        private BigDecimal successRate;
        private BigDecimal conversionRate;
        private long buyers;
        private BigDecimal averageGroupSize;
        private long unitsSold;
        private BigDecimal revenue;
        private BigDecimal customerSavings;
        private BigDecimal refunds;
    }
}
