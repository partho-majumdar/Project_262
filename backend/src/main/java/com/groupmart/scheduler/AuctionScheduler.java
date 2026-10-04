package com.groupmart.scheduler;

import java.time.LocalDateTime;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.groupmart.repository.AuctionRepository;
import com.groupmart.service.AuctionClosingService;
import com.groupmart.service.AuctionService;

/**
 * Drives the timed parts of the proxy-auction lifecycle: promoting scheduled auctions to LIVE, and
 * closing live auctions once their deadline passes.
 * <p>
 * Each auction is handled in its own transaction, so one bad auction cannot stall the sweep, and the
 * close is idempotent, so an overlapping tick is harmless.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AuctionScheduler {

    private final AuctionRepository auctionRepository;
    private final AuctionService auctionService;
    private final AuctionClosingService closingService;

    @Scheduled(fixedDelay = 30_000, initialDelay = 20_000)
    public void openScheduledAuctions() {
        try {
            int opened = auctionService.openDueAuctions();
            if (opened > 0) {
                log.info("Auction scheduler opened {} scheduled auction(s)", opened);
            }
        } catch (Exception ex) {
            log.error("Auction scheduler could not open scheduled auctions: {}", ex.getMessage(), ex);
        }
    }

    @Scheduled(fixedDelay = 30_000, initialDelay = 25_000)
    public void closeExpiredAuctions() {
        LocalDateTime now = LocalDateTime.now();
        for (UUID auctionId : auctionRepository.findExpiredLiveAuctionIds(now)) {
            // Each close commits on its own; a failure here must not affect the rest of the sweep.
            try {
                closingService.close(auctionId, null, false);
            } catch (Exception ex) {
                log.error("Auction scheduler could not close auction {}: {}", auctionId, ex.getMessage(), ex);
            }
        }
    }
}
