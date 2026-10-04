package com.groupmart.scheduler;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.groupmart.entity.GroupReverseDemand;
import com.groupmart.repository.GroupReverseDemandRepository;
import com.groupmart.service.GroupReverseClosingService;

/**
 * Polls for group reverse demands whose deadlines have passed and hands each one to
 * {@link GroupReverseClosingService}.
 * <p>
 * The scheduler itself holds no transaction and no lazy state; it only finds the due rows and
 * delegates. All the work happens in the closing service, once per demand, so a single bad row
 * cannot stop the rest of the sweep.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GroupReverseScheduler {

    private static final long POLL_MS = 30_000L;

    private final GroupReverseDemandRepository demandRepository;
    private final GroupReverseClosingService closingService;

    @Scheduled(fixedDelayString = "${groupmart.group-reverse.sweep-ms:30000}")
    public void sweepDeadlines() {
        LocalDateTime now = LocalDateTime.now();
        for (GroupReverseDemand due : safeRead(() -> demandRepository.findJoinDeadlineExpired(now))) {
            closeSafely(due.getId(), now, true);
        }
        for (GroupReverseDemand due : safeRead(() -> demandRepository.findOfferDeadlineExpired(now))) {
            closeSafely(due.getId(), now, false);
        }
    }

    private void closeSafely(UUID demandId, LocalDateTime now, boolean joinWindow) {
        try {
            if (joinWindow) {
                closingService.expireJoinWindow(demandId, now);
            } else {
                closingService.expireOfferWindow(demandId, now);
            }
        } catch (Exception ex) {
            // One unclosable demand must not strand every other demand in this sweep.
            log.warn("Could not close expired group reverse demand {}", demandId, ex);
        }
    }

    private List<GroupReverseDemand> safeRead(Supplier<List<GroupReverseDemand>> query) {
        try {
            return query.get();
        } catch (Exception ex) {
            log.warn("Group reverse deadline sweep could not read due demands", ex);
            return List.of();
        }
    }
}
