package com.groupmart.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.GroupBuyParticipant;
import com.groupmart.entity.GroupBuyParticipantStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GroupBuyParticipantRepository extends JpaRepository<GroupBuyParticipant, UUID> {

    Optional<GroupBuyParticipant> findByBuyGroupIdAndUserId(UUID groupId, UUID userId);

    List<GroupBuyParticipant> findByBuyGroupIdOrderByJoinedAtAsc(UUID groupId);

    List<GroupBuyParticipant> findByBuyGroupIdAndStatusOrderByJoinedAtAsc(UUID groupId, GroupBuyParticipantStatus status);

    List<GroupBuyParticipant> findByUserIdOrderByJoinedAtDesc(UUID userId);

    Optional<GroupBuyParticipant> findByOrderId(UUID orderId);

    long countByInvitedByIdAndStatusIn(UUID inviterId, Collection<GroupBuyParticipantStatus> statuses);

    // Admin monitoring: newest participations with everything the tables show, loaded in one query
    @Query("SELECT p FROM GroupBuyParticipant p JOIN FETCH p.user JOIN FETCH p.buyGroup g " +
           "JOIN FETCH g.campaign c JOIN FETCH c.sellerStore JOIN FETCH c.product " +
           "WHERE p.joinedAt >= :since OR p.leftAt >= :since ORDER BY p.joinedAt DESC")
    List<GroupBuyParticipant> findActivitySince(@Param("since") LocalDateTime since);

    // Analytics: joins made in a window, with the campaign, store and product each join belongs to
    @Query("SELECT p FROM GroupBuyParticipant p JOIN FETCH p.buyGroup g " +
           "JOIN FETCH g.campaign c JOIN FETCH c.sellerStore JOIN FETCH c.product WHERE p.joinedAt >= :since")
    List<GroupBuyParticipant> findJoinedSince(@Param("since") LocalDateTime since);

    @Query("SELECT p FROM GroupBuyParticipant p JOIN FETCH p.buyGroup g " +
           "JOIN FETCH g.campaign c JOIN FETCH c.sellerStore JOIN FETCH c.product " +
           "WHERE p.joinedAt >= :since AND c.sellerStore.id = :storeId")
    List<GroupBuyParticipant> findJoinedSinceForStore(@Param("since") LocalDateTime since, @Param("storeId") UUID storeId);

    @Query("SELECT p FROM GroupBuyParticipant p JOIN FETCH p.user JOIN FETCH p.buyGroup g " +
           "JOIN FETCH g.campaign c JOIN FETCH c.sellerStore JOIN FETCH c.product " +
           "ORDER BY p.joinedAt DESC")
    List<GroupBuyParticipant> findRecent(Pageable pageable);

    @Query("SELECT p FROM GroupBuyParticipant p JOIN FETCH p.user JOIN FETCH p.buyGroup g " +
           "JOIN FETCH g.campaign c JOIN FETCH c.sellerStore JOIN FETCH c.product " +
           "WHERE p.status = :status ORDER BY p.joinedAt DESC")
    List<GroupBuyParticipant> findRecentByStatus(@Param("status") GroupBuyParticipantStatus status, Pageable pageable);

    @Query("SELECT p FROM GroupBuyParticipant p JOIN FETCH p.user JOIN FETCH p.order o JOIN FETCH p.buyGroup g " +
           "JOIN FETCH g.campaign c JOIN FETCH c.sellerStore JOIN FETCH c.product ORDER BY o.createdAt DESC")
    List<GroupBuyParticipant> findRecentWithOrders(Pageable pageable);

    @Query("SELECT p FROM GroupBuyParticipant p JOIN FETCH p.user WHERE p.buyGroup.id IN :groupIds")
    List<GroupBuyParticipant> findByGroupIds(@Param("groupIds") Collection<UUID> groupIds);

    @Query("SELECT COALESCE(SUM((c.basePrice - p.finalUnitPrice) * p.quantity), 0) FROM GroupBuyParticipant p " +
           "JOIN p.buyGroup g JOIN g.campaign c " +
           "WHERE p.status = com.groupmart.entity.GroupBuyParticipantStatus.CONVERTED AND p.finalUnitPrice IS NOT NULL")
    BigDecimal sumCustomerSavings();

    @Query("SELECT p.status, COUNT(p), COALESCE(SUM(p.amountPaid), 0), COALESCE(SUM(p.refundAmount), 0) " +
           "FROM GroupBuyParticipant p GROUP BY p.status")
    List<Object[]> aggregateByStatus();

    @Query("SELECT p.buyGroup.id FROM GroupBuyParticipant p " +
           "WHERE p.user.id = :userId AND p.buyGroup.campaign.id = :campaignId " +
           "AND p.status = com.groupmart.entity.GroupBuyParticipantStatus.JOINED " +
           "AND p.buyGroup.status = com.groupmart.entity.GroupBuyGroupStatus.OPEN")
    List<UUID> findActiveGroupIdsInCampaign(@Param("userId") UUID userId, @Param("campaignId") UUID campaignId);
}
