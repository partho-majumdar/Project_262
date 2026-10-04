package com.groupmart.dto.groupbuy;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuyDealDetailDto {

    private GroupBuyCampaignDto campaign;
    private List<GroupBuyGroupDto> openGroups;
    private List<GroupBuyGroupDto> recentSuccessfulGroups;
    private UUID myActiveGroupId;
    private boolean canStartGroup;
    private String startGroupBlockedReason;
    private boolean following;
    private long followerCount;
}
