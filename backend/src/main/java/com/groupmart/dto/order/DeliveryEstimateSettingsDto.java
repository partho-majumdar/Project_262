package com.groupmart.dto.order;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Platform rule that fills in the estimated delivery date customers see on order tracking.
 * Stored as platform settings so an administrator can change it without a deploy.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeliveryEstimateSettingsDto {

    @Min(value = 0, message = "Standard delivery days cannot be negative")
    @Max(value = 90, message = "Standard delivery days must be at most 90")
    private Integer standardDays;

    @Min(value = 0, message = "Express delivery days cannot be negative")
    @Max(value = 90, message = "Express delivery days must be at most 90")
    private Integer expressDays;

    @Min(value = 0, message = "Overnight delivery days cannot be negative")
    @Max(value = 90, message = "Overnight delivery days must be at most 90")
    private Integer overnightDays;

    /** Extra days added for group buy orders, which ship after the group settles. */
    @Min(value = 0, message = "Group buy extra days cannot be negative")
    @Max(value = 90, message = "Group buy extra days must be at most 90")
    private Integer groupBuyExtraDays;

    /** Hour of the day the estimate lands on, e.g. 17 shows "by 5:00 PM". */
    @Min(value = 0, message = "Cut-off hour must be between 0 and 23")
    @Max(value = 23, message = "Cut-off hour must be between 0 and 23")
    private Integer cutoffHour;

    /** When true, Friday and Saturday are not counted as delivery days. */
    private Boolean skipWeekends;

    /** Re-dates orders still on the automatic estimate after the rule is saved. */
    private Boolean recalculateExisting;

    /** How many orders the last save re-dated; ignored on input. */
    private Integer recalculatedOrders;
}
