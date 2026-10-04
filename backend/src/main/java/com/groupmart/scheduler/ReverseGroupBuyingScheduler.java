package com.groupmart.scheduler;

import java.time.LocalDateTime;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.groupmart.entity.ReverseGroupBuyingCloseCode;
import com.groupmart.repository.ReverseGroupBuyingOfferRepository;
import com.groupmart.service.ReverseGroupBuyingOfferService;

/**
 * Enforces Reverse Group Buying participation deadlines server-side. An offer whose deadline passed
 * with the target condition met is unlocked; one that fell short is failed and every active
 * participation is refunded. Each offer is processed in its own transaction so one failure never
 * blocks the rest.
 * <p>
 * Follows the same scheduling pattern as the existing WholesaleScheduler - no second scheduler
 * framework is introduced.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ReverseGroupBuyingScheduler {

    private final ReverseGroupBuyingOfferRepository offerRepository;
    private final ReverseGroupBuyingOfferService offerService;

    @Scheduled(fixedDelay = 30_000, initialDelay = 27_000)
    public void processExpiredOffers() {
        LocalDateTime now = LocalDateTime.now();
        for (UUID offerId : offerRepository.findExpiredOpenOfferIds(now)) {
            safely("process expired reverse group buying offer", offerId,
                    () -> offerService.expireOfferIfDue(offerId,
                            ReverseGroupBuyingCloseCode.DEADLINE_REACHED_BELOW_TARGET));
        }
    }

    private void safely(String action, UUID id, Runnable task) {
        try {
            task.run();
        } catch (Exception ex) {
            log.error("Reverse group buying scheduler failed to {} {}: {}", action, id, ex.getMessage());
        }
    }
}
