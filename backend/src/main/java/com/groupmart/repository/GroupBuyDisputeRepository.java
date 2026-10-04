package com.groupmart.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.GroupBuyDispute;
import com.groupmart.entity.GroupBuyDisputeStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface GroupBuyDisputeRepository extends JpaRepository<GroupBuyDispute, UUID> {

    List<GroupBuyDispute> findAllByOrderByCreatedAtDesc();

    List<GroupBuyDispute> findByStatusInOrderByCreatedAtDesc(Collection<GroupBuyDisputeStatus> statuses);

    List<GroupBuyDispute> findByRaisedByIdOrderByCreatedAtDesc(UUID userId);

    List<GroupBuyDispute> findByParticipantIdOrderByCreatedAtDesc(UUID participantId);

    @Query("SELECT d FROM GroupBuyDispute d WHERE d.participant.buyGroup.id = :groupId ORDER BY d.createdAt DESC")
    List<GroupBuyDispute> findByGroupId(@Param("groupId") UUID groupId);

    boolean existsByParticipantIdAndStatusIn(UUID participantId, Collection<GroupBuyDisputeStatus> statuses);

    long countByStatusIn(Collection<GroupBuyDisputeStatus> statuses);

    List<GroupBuyDispute> findByCreatedAtGreaterThanEqual(LocalDateTime since);

    // Rows of [participantId, refunded]
    @Query("SELECT d.participant.id, COALESCE(SUM(d.refundAmount), 0) FROM GroupBuyDispute d " +
           "WHERE d.participant.id IN :participantIds GROUP BY d.participant.id")
    List<Object[]> sumRefundsByParticipantIds(@Param("participantIds") Collection<UUID> participantIds);

    @Query("SELECT COALESCE(SUM(d.refundAmount), 0) FROM GroupBuyDispute d")
    BigDecimal sumAllRefunds();

    @Query("SELECT COALESCE(SUM(d.refundAmount), 0) FROM GroupBuyDispute d WHERE d.participant.id = :participantId")
    BigDecimal sumRefundsByParticipant(@Param("participantId") UUID participantId);
}
