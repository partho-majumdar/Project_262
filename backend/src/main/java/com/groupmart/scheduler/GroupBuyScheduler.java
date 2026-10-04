package com.groupmart.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.groupmart.repository.GroupBuyCampaignRepository;
import com.groupmart.repository.GroupBuyGroupRepository;
import com.groupmart.service.GroupBuyLifecycleService;
import com.groupmart.service.impl.GroupBuyDealAlerts;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Drives time-based group buy transitions. Each item runs in its own transaction
 * so one failing campaign or group does not block the rest.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GroupBuyScheduler {

    private final GroupBuyCampaignRepository campaignRepository;
    private final GroupBuyGroupRepository groupRepository;
    private final GroupBuyLifecycleService lifecycleService;

    @Scheduled(fixedDelay = 30_000, initialDelay = 20_000)
    public void runLifecycle() {
        LocalDateTime now = LocalDateTime.now();

        campaignRepository.findScheduledReadyToStart(now)
                .forEach(id -> safely("activate campaign", id, () -> lifecycleService.activateCampaign(id, true)));

        groupRepository.findExpiredOpenGroupIds(now)
                .forEach(id -> safely("settle group", id, () -> lifecycleService.settleGroup(id)));

        campaignRepository.findRunningPastEnd(now)
                .forEach(id -> safely("close campaign", id, () -> lifecycleService.closeCampaign(id, null)));

        groupRepository.findGroupIdsNeedingExpiryReminder(now, now.plusHours(1))
                .forEach(id -> safely("send expiry reminder for group", id, () -> lifecycleService.sendExpiryReminder(id)));

        campaignRepository.findFollowedEndingSoon(now, now.plusHours(GroupBuyDealAlerts.ENDING_SOON_HOURS))
                .forEach(id -> safely("send follower ending reminder for campaign", id,
                        () -> lifecycleService.sendFollowerEndingReminder(id)));
    }

    private void safely(String action, UUID id, Runnable task) {
        try {
            task.run();
        } catch (Exception ex) {
            log.error("Group buy scheduler failed to {} {}: {}", action, id, ex.getMessage());
        }
    }
}
