package com.groupmart.service;

import com.groupmart.dto.groupbuy.*;

import java.util.List;
import java.util.UUID;

/** Customer-facing group buying: browsing deals, starting, joining and leaving groups. */
public interface GroupBuyService {

    List<GroupBuyCampaignDto> getActiveDeals(String query, String categorySlug, String sort);

    GroupBuyDealDetailDto getDeal(UUID campaignId, String viewerEmail);

    List<GroupBuyCampaignDto> getActiveDealsForProduct(UUID productId);

    GroupBuyGroupDto getGroup(UUID groupId, String viewerEmail);

    GroupBuyGroupDto getGroupByInviteCode(String inviteCode, String viewerEmail);

    GroupBuyGroupDto startGroup(String userEmail, UUID campaignId, JoinGroupBuyRequest request);

    GroupBuyGroupDto joinGroup(String userEmail, UUID groupId, JoinGroupBuyRequest request);

    GroupBuyGroupDto leaveGroup(String userEmail, UUID groupId);

    GroupBuyDealDetailDto followDeal(String userEmail, UUID campaignId);

    GroupBuyDealDetailDto unfollowDeal(String userEmail, UUID campaignId);

    List<GroupBuyCampaignDto> getFollowedDeals(String userEmail);

    List<GroupBuyGroupDto> getMyGroups(String userEmail, String filter);

    GroupBuyStatsDto getMyStats(String userEmail);
}
