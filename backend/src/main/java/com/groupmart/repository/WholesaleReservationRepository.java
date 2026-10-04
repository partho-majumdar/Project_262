package com.groupmart.repository;

import com.groupmart.entity.WholesaleReservation;
import com.groupmart.entity.WholesaleReservationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WholesaleReservationRepository extends JpaRepository<WholesaleReservation, UUID> {

    List<WholesaleReservation> findByPoolIdAndStatus(UUID poolId, WholesaleReservationStatus status);

    List<WholesaleReservation> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<WholesaleReservation> findByIdAndUserId(UUID id, UUID userId);

    List<WholesaleReservation> findByPoolIdOrderByCreatedAtAsc(UUID poolId);

    @Query("SELECT COUNT(r) FROM WholesaleReservation r WHERE r.pool.id = :poolId " +
           "AND r.status = com.groupmart.entity.WholesaleReservationStatus.RESERVED")
    long countActiveByPool(@Param("poolId") UUID poolId);
}
