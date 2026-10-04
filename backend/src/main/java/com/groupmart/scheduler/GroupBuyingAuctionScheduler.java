package com.groupmart.scheduler;

import java.time.LocalDateTime;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.groupmart.repository.GroupBuyingAuctionRepository;
import com.groupmart.service.GroupBuyingAuctionService;

/**
 * Server-side enforcement of the Group Buying Auction window: published auctions open when their
 * start time arrives, and open auctions are finalized when their end time passes. The frontend never
 * decides either outcome. Each auction is processed in its own transaction, and finalization is
 * one-shot, so a sweep overlapping a seller action cannot finalize an auction twice.
 * <p>
 * Follows the same scheduling pattern as the existing WholesaleScheduler - no second scheduler
 * framework is introduced.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GroupBuyingAuctionScheduler {

    private final GroupBuyingAuctionRepository auctionRepository;
    private final GroupBuyingAuctionService auctionService;

    @Scheduled(fixedDelay = 30_000, initialDelay = 28_000)
    public void processAuctionWindows() {
        LocalDateTime now = LocalDateTime.now();
        auctionRepository.findDueToOpenIds(now)
                .forEach(id -> safely("open due group buying auction", id, () -> auctionService.openDueAuction(id)));
        auctionRepository.findExpiredOpenIds(now)
                .forEach(id -> safely("finalize expired group buying auction", id,
                        () -> auctionService.finalizeExpiredAuction(id)));
    }

    private void safely(String action, UUID id, Runnable task) {
        try {
            task.run();
        } catch (Exception ex) {
            log.error("Group buying auction scheduler failed to {} {}: {}", action, id, ex.getMessage());
        }
    }
}
