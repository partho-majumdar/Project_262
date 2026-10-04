package com.groupmart.dto.groupbuy;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.groupmart.entity.GroupBuyGroupStatus;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuyGroupDto {

    private UUID id;
    private String inviteCode;
    private GroupBuyGroupStatus status;
    private GroupBuyCampaignDto campaign;

    private UUID leaderId;
    private String leaderName;
    private String startedByName;
    private boolean viewerLeader;
    private boolean viewerStarted;

    private int participantCount;
    private int minParticipants;
    private int maxParticipants;
    private int spotsToMinimum;
    private int spotsLeft;
    private int totalQuantity;
    private int progressPercent;
    private boolean almostThere;
    private String urgencyMessage;

    private BigDecimal basePrice;
    private BigDecimal currentUnitPrice;
    private BigDecimal currentDiscountPercent;
    private GroupBuyTierDto nextTier;
    private int participantsToNextTier;
    private List<GroupBuyTierDto> priceLadder;

    private LocalDateTime expiresAt;
    private LocalDateTime completedAt;
    private BigDecimal finalUnitPrice;
    private String failureReason;

    private boolean joinable;
    private String joinBlockedReason;

    // Only populated on detail views
    private List<GroupBuyParticipantDto> participants;
    private List<GroupBuyActivityDto> activities;

    private GroupBuyMembershipDto myMembership;
    private LocalDateTime createdAt;
}
