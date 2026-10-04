package com.groupmart.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.GroupReverseDemand;
import com.groupmart.entity.GroupReverseDemandStatus;

/**
 * Group reverse demands.
 * <p>
 * Note the naming intent versus {@link com.groupmart.repository.ReverseGroupBuyingCampaignRepository}:
 * that table belongs to the seller-initiated mechanism. These are customer-created demands, where
 * sellers compete.
 */
@Repository
public interface GroupReverseDemandRepository extends JpaRepository<GroupReverseDemand, UUID> {

    /**
     * Reads the demand under a {@code SELECT ... FOR UPDATE} row lock.
     * <p>
     * Every mutation that touches {@code committedQuantity} must go through this rather than
     * {@code findById}. Two customers joining the last remaining units at the same instant would
     * both read the same stale total under a plain read and both succeed, oversubscribing the
     * group. The lock makes the second one wait and then re-check against the committed total.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT d FROM GroupReverseDemand d WHERE d.id = :id")
    Optional<GroupReverseDemand> findByIdForUpdate(@Param("id") UUID id);

    /** Demands any customer may browse: published and not yet closed. */
    @Query("""
            SELECT d FROM GroupReverseDemand d
            WHERE d.status IN :statuses
            ORDER BY d.createdAt DESC
            """)
    List<GroupReverseDemand> findDiscoverable(@Param("statuses") List<GroupReverseDemandStatus> statuses);

    List<GroupReverseDemand> findByLeaderIdOrderByCreatedAtDesc(UUID leaderId);

    List<GroupReverseDemand> findByProductIdOrderByCreatedAtDesc(UUID productId);

    List<GroupReverseDemand> findByStatusOrderByCreatedAtDesc(GroupReverseDemandStatus status);

    List<GroupReverseDemand> findByStatusInOrderByCreatedAtDesc(List<GroupReverseDemandStatus> statuses);

    /** OPEN demands whose join deadline has passed, so the sweeper can retire them. */
    @Query("""
            SELECT d FROM GroupReverseDemand d
            WHERE d.status = com.groupmart.entity.GroupReverseDemandStatus.OPEN
              AND d.joinDeadline < :now
            """)
    List<GroupReverseDemand> findJoinDeadlineExpired(@Param("now") LocalDateTime now);

    /**
     * Demands waiting for the creator to pick a seller but past their offer deadline, plus those
     * that reached their offer deadline with no offer at all.
     */
    @Query("""
            SELECT d FROM GroupReverseDemand d
            WHERE d.status IN (com.groupmart.entity.GroupReverseDemandStatus.READY_FOR_OFFERS,
                               com.groupmart.entity.GroupReverseDemandStatus.OFFERS_RECEIVED)
              AND d.offerDeadline < :now
            """)
    List<GroupReverseDemand> findOfferDeadlineExpired(@Param("now") LocalDateTime now);
}
