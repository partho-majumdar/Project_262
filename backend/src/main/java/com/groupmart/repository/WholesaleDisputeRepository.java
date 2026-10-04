package com.groupmart.repository;

import com.groupmart.entity.WholesaleDispute;
import com.groupmart.entity.WholesaleDisputeStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface WholesaleDisputeRepository extends JpaRepository<WholesaleDispute, UUID> {

    List<WholesaleDispute> findAllByOrderByCreatedAtDesc();

    List<WholesaleDispute> findByStatusInOrderByCreatedAtDesc(Collection<WholesaleDisputeStatus> statuses);

    List<WholesaleDispute> findByRaisedByIdOrderByCreatedAtDesc(UUID userId);

    List<WholesaleDispute> findByReservationIdOrderByCreatedAtDesc(UUID reservationId);

    boolean existsByReservationIdAndStatusIn(UUID reservationId, Collection<WholesaleDisputeStatus> statuses);

    @Query("SELECT COALESCE(SUM(d.refundAmount), 0) FROM WholesaleDispute d WHERE d.reservation.id = :reservationId")
    BigDecimal sumRefundsByReservation(@Param("reservationId") UUID reservationId);
}
