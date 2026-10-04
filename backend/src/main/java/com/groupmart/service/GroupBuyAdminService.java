package com.groupmart.service;

import com.groupmart.dto.groupbuy.admin.*;

import java.util.List;
import java.util.UUID;

/** Platform-wide group buy monitoring, moderation, and fraud review for administrators. */
public interface GroupBuyAdminService {

    AdminGroupBuyOverviewDto getOverview();

    List<AdminGroupBuyParticipantDto> getParticipants(String status, String query, int limit);

    List<AdminGroupBuyParticipantDto> getOrders(int limit);

    List<AdminGroupBuyActivityDto> getActivity(int limit);

    List<GroupBuyInventoryLogDto> getInventoryLogs();

    AdminGroupBuyGroupDetailDto getGroup(UUID groupId);

    AdminGroupBuyGroupDetailDto cancelGroup(String adminEmail, UUID groupId, String reason);

    AdminGroupBuyGroupDetailDto removeMember(String adminEmail, UUID groupId, UUID userId, String reason);

    /** Orders for the delivery board: {@code scope} is GROUP_BUY or ALL, {@code status} a status, OPEN or ALL. */
    List<com.groupmart.dto.order.OrderDto> getDeliveryBoard(String scope, String status, String query, int limit);

    List<GroupBuyFraudFlagDto> getFraudFlags(int days, boolean includeReviewed);

    GroupBuyFraudFlagDto reviewFlag(String adminEmail, GroupBuyFlagReviewRequest request, int days);
}
