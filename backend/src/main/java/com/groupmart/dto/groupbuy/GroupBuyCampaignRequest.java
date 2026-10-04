package com.groupmart.dto.groupbuy;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuyCampaignRequest {

    @NotNull(message = "Product is required")
    private UUID productId;

    @NotBlank(message = "Title is required")
    @Size(max = 200, message = "Title must be at most 200 characters")
    private String title;

    @Size(max = 2000, message = "Description must be at most 2000 characters")
    private String description;

    @NotNull(message = "Minimum participants is required")
    @Min(value = 2, message = "A group needs at least 2 participants")
    private Integer minParticipants;

    @NotNull(message = "Maximum participants is required")
    @Min(value = 2, message = "Maximum participants must be at least 2")
    @Max(value = 500, message = "Maximum participants must be at most 500")
    private Integer maxParticipants;

    @NotNull(message = "Maximum quantity per customer is required")
    @Min(value = 1, message = "Maximum quantity per customer must be at least 1")
    private Integer maxQuantityPerUser;

    @NotNull(message = "Reserved quantity is required")
    @Min(value = 1, message = "Reserve at least 1 unit")
    private Integer reservedQuantity;

    @NotNull(message = "Group duration is required")
    @Min(value = 1, message = "Group duration must be at least 1 hour")
    @Max(value = 720, message = "Group duration must be at most 720 hours (30 days)")
    private Integer groupDurationHours;

    @NotNull(message = "Start time is required")
    private LocalDateTime startAt;

    @NotNull(message = "End time is required")
    private LocalDateTime endAt;

    @NotEmpty(message = "Add at least one price tier")
    @Valid
    private List<GroupBuyTierRequest> tiers;
}
