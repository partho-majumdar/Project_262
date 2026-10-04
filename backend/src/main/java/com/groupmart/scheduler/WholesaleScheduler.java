package com.groupmart.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.groupmart.repository.WholesaleOfferRepository;
import com.groupmart.repository.WholesalePoolRepository;
import com.groupmart.service.WholesaleOfferService;
import com.groupmart.service.WholesalePoolService;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Sweeps CWP pools and offers past their reservation deadline (spec section 13). Each is handled in
 * its own transaction so one failure does not block the rest.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WholesaleScheduler {

    private final WholesalePoolRepository poolRepository;
    private final WholesalePoolService poolService;
    private final WholesaleOfferRepository offerRepository;
    private final WholesaleOfferService offerService;

    @Scheduled(fixedDelay = 30_000, initialDelay = 25_000)
    public void failExpiredPools() {
        LocalDateTime now = LocalDateTime.now();
        poolRepository.findExpiredOpenPoolIds(now)
                .forEach(id -> safely("fail expired wholesale pool", id, () -> poolService.failExpiredPool(id)));
    }

    /**
     * Closes offers whose reservation window has elapsed. Without this an offer stays ACTIVE for
     * ever, so a seller sees a dead offer as Live and is offered Pause and Resume actions that can
     * no longer do anything useful.
     */
    @Scheduled(fixedDelay = 30_000, initialDelay = 28_000)
    public void closeExpiredOffers() {
        LocalDateTime now = LocalDateTime.now();
        offerRepository.findExpiredOpenOfferIds(now)
                .forEach(id -> safely("close expired wholesale offer", id, () -> offerService.closeExpiredOffer(id)));
    }

    private void safely(String action, UUID id, Runnable task) {
        try {
            task.run();
        } catch (Exception ex) {
            log.error("Wholesale scheduler failed to {} {}: {}", action, id, ex.getMessage());
        }
    }
}
