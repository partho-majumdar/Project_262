package com.groupmart.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.GroupBuyCampaign;
import com.groupmart.entity.GroupBuyCampaignStatus;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GroupBuyCampaignRepository extends JpaRepository<GroupBuyCampaign, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM GroupBuyCampaign c WHERE c.id = :id")
    Optional<GroupBuyCampaign> findByIdForUpdate(@Param("id") UUID id);

    List<GroupBuyCampaign> findBySellerStoreIdOrderByCreatedAtDesc(UUID sellerStoreId);

    List<GroupBuyCampaign> findByStatusOrderByEndAtAsc(GroupBuyCampaignStatus status);

    List<GroupBuyCampaign> findByStatusInOrderByCreatedAtDesc(Collection<GroupBuyCampaignStatus> statuses);

    List<GroupBuyCampaign> findAllByOrderByCreatedAtDesc();

    @Query("SELECT c FROM GroupBuyCampaign c JOIN FETCH c.sellerStore JOIN FETCH c.product ORDER BY c.createdAt DESC")
    List<GroupBuyCampaign> findAllWithStore();

    @Query("SELECT c FROM GroupBuyCampaign c JOIN FETCH c.sellerStore JOIN FETCH c.product " +
           "WHERE c.sellerStore.id = :storeId ORDER BY c.createdAt DESC")
    List<GroupBuyCampaign> findByStoreWithProduct(@Param("storeId") UUID storeId);

    // Single row: [reserved, committed] for campaigns whose reservation is still held out of product stock
    @Query("SELECT COALESCE(SUM(c.reservedQuantity), 0), COALESCE(SUM(c.committedQuantity), 0) FROM GroupBuyCampaign c " +
           "WHERE c.inventoryReserved = true AND c.inventoryReleased = false")
    List<Object[]> heldInventoryTotals();

    @Query("SELECT COALESCE(SUM(c.soldQuantity), 0) FROM GroupBuyCampaign c")
    Number sumSoldQuantity();

    @Query("SELECT c.status, COUNT(c) FROM GroupBuyCampaign c GROUP BY c.status")
    List<Object[]> countByStatus();

    List<GroupBuyCampaign> findByProductIdAndStatus(UUID productId, GroupBuyCampaignStatus status);

    @Query("SELECT c.id FROM GroupBuyCampaign c " +
           "WHERE c.status = com.groupmart.entity.GroupBuyCampaignStatus.SCHEDULED AND c.startAt <= :now")
    List<UUID> findScheduledReadyToStart(@Param("now") LocalDateTime now);

    @Query("SELECT c.id FROM GroupBuyCampaign c " +
           "WHERE c.status IN (com.groupmart.entity.GroupBuyCampaignStatus.ACTIVE, com.groupmart.entity.GroupBuyCampaignStatus.PAUSED) " +
           "AND c.endAt <= :now")
    List<UUID> findRunningPastEnd(@Param("now") LocalDateTime now);

    @Query("SELECT c.id FROM GroupBuyCampaign c " +
           "WHERE c.status = com.groupmart.entity.GroupBuyCampaignStatus.ACTIVE " +
           "AND c.followersEndingAlertAt IS NULL AND c.endAt > :now AND c.endAt <= :threshold " +
           "AND EXISTS (SELECT f.id FROM GroupBuyDealFollow f WHERE f.campaign = c)")
    List<UUID> findFollowedEndingSoon(@Param("now") LocalDateTime now, @Param("threshold") LocalDateTime threshold);
}
