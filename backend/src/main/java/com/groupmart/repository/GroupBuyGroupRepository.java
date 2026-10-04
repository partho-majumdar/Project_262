package com.groupmart.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.GroupBuyGroup;
import com.groupmart.entity.GroupBuyGroupStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GroupBuyGroupRepository extends JpaRepository<GroupBuyGroup, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT g FROM GroupBuyGroup g WHERE g.id = :id")
    Optional<GroupBuyGroup> findByIdForUpdate(@Param("id") UUID id);

    // Scalar lookup so the campaign can be locked before the group entity is loaded.
    @Query("SELECT g.campaign.id FROM GroupBuyGroup g WHERE g.id = :groupId")
    Optional<UUID> findCampaignIdByGroupId(@Param("groupId") UUID groupId);

    Optional<GroupBuyGroup> findByInviteCode(String inviteCode);

    boolean existsByInviteCode(String inviteCode);

    List<GroupBuyGroup> findByCampaignIdOrderByCreatedAtDesc(UUID campaignId);

    long countByCampaignIdAndStatus(UUID campaignId, GroupBuyGroupStatus status);

    @Query("SELECT g.id FROM GroupBuyGroup g " +
           "WHERE g.campaign.id = :campaignId AND g.status = com.groupmart.entity.GroupBuyGroupStatus.OPEN")
    List<UUID> findOpenGroupIdsByCampaign(@Param("campaignId") UUID campaignId);

    @Query("SELECT g.id FROM GroupBuyGroup g " +
           "WHERE g.status = com.groupmart.entity.GroupBuyGroupStatus.OPEN AND g.expiresAt <= :now")
    List<UUID> findExpiredOpenGroupIds(@Param("now") LocalDateTime now);

    @Query("SELECT g.id FROM GroupBuyGroup g " +
           "WHERE g.status = com.groupmart.entity.GroupBuyGroupStatus.OPEN AND g.expiryReminderSent = false " +
           "AND g.expiresAt > :now AND g.expiresAt <= :threshold")
    List<UUID> findGroupIdsNeedingExpiryReminder(@Param("now") LocalDateTime now,
                                                 @Param("threshold") LocalDateTime threshold);

    @Query("SELECT g FROM GroupBuyGroup g JOIN FETCH g.campaign c JOIN FETCH c.sellerStore JOIN FETCH c.product " +
           "WHERE g.createdAt >= :since OR g.completedAt >= :since")
    List<GroupBuyGroup> findTouchedSince(@Param("since") LocalDateTime since);

    @Query("SELECT g FROM GroupBuyGroup g JOIN FETCH g.campaign c JOIN FETCH c.sellerStore JOIN FETCH c.product " +
           "WHERE c.sellerStore.id = :storeId AND (g.createdAt >= :since OR g.completedAt >= :since)")
    List<GroupBuyGroup> findTouchedSinceForStore(@Param("since") LocalDateTime since, @Param("storeId") UUID storeId);

    // Single row: [openGroups, participantsInOpenGroups]
    @Query("SELECT COUNT(g), COALESCE(SUM(g.participantCount), 0) FROM GroupBuyGroup g " +
           "WHERE g.status = com.groupmart.entity.GroupBuyGroupStatus.OPEN")
    List<Object[]> openTotals();

    @Query("SELECT COUNT(g), COALESCE(SUM(g.participantCount), 0) FROM GroupBuyGroup g " +
           "WHERE g.status = com.groupmart.entity.GroupBuyGroupStatus.OPEN AND g.campaign.sellerStore.id = :storeId")
    List<Object[]> openTotalsForStore(@Param("storeId") UUID storeId);

    @Query("SELECT g.status, COUNT(g) FROM GroupBuyGroup g GROUP BY g.status")
    List<Object[]> countByStatus();

    // Rows of [status, groupCount, participantSum]
    @Query("SELECT g.status, COUNT(g), COALESCE(SUM(g.participantCount), 0) FROM GroupBuyGroup g " +
           "WHERE g.campaign.id = :campaignId GROUP BY g.status")
    List<Object[]> aggregateByCampaign(@Param("campaignId") UUID campaignId);
}
