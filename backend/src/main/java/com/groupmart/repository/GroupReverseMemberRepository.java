package com.groupmart.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.GroupReverseMember;
import com.groupmart.entity.GroupReverseMemberStatus;

@Repository
public interface GroupReverseMemberRepository extends JpaRepository<GroupReverseMember, UUID> {

    Optional<GroupReverseMember> findByDemandIdAndCustomerId(UUID demandId, UUID customerId);

    List<GroupReverseMember> findByDemandIdOrderByJoinedAtAsc(UUID demandId);

    List<GroupReverseMember> findByCustomerIdOrderByJoinedAtDesc(UUID customerId);

    List<GroupReverseMember> findByDemandIdAndStatus(UUID demandId, GroupReverseMemberStatus status);

    /**
     * Members of a demand, as a count. The leader dashboard and the seller marketplace need the
     * group size without dragging every member row across the wire.
     */
    @Query("SELECT COUNT(m) FROM GroupReverseMember m WHERE m.demand.id = :demandId")
    long countByDemandId(@Param("demandId") UUID demandId);

    /**
     * Members who still count towards the group, i.e. everybody except the withdrawn ones. This is
     * the number the group actually has to deal with, so it must shrink when somebody leaves and
     * must keep counting after a selection promotes members to CONFIRMED / ORDER_CREATED.
     */
    @Query("""
            SELECT COUNT(m) FROM GroupReverseMember m
            WHERE m.demand.id = :demandId
              AND m.status <> com.groupmart.entity.GroupReverseMemberStatus.CANCELLED
            """)
    long countActiveByDemandId(@Param("demandId") UUID demandId);

    /** Sum of requested quantities across active members - the authoritative group total. */
    @Query("""
            SELECT COALESCE(SUM(m.requestedQuantity), 0) FROM GroupReverseMember m
            WHERE m.demand.id = :demandId
              AND m.status = com.groupmart.entity.GroupReverseMemberStatus.JOINED
            """)
    long sumActiveQuantity(@Param("demandId") UUID demandId);
}
