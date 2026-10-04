package com.groupmart.repository;

import com.groupmart.entity.WholesalePool;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WholesalePoolRepository extends JpaRepository<WholesalePool, UUID> {

    // Row-locked read used inside the reserve-quantity transaction so concurrent reservations
    // against the same pool serialize instead of racing past lotCapacity (spec section 15).
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM WholesalePool p WHERE p.id = :id")
    Optional<WholesalePool> findByIdForUpdate(@Param("id") UUID id);

    List<WholesalePool> findByOfferIdOrderByLotNumberDesc(UUID offerId);

    @Query("SELECT MAX(p.lotNumber) FROM WholesalePool p WHERE p.offer.id = :offerId")
    Optional<Integer> findMaxLotNumberForOffer(@Param("offerId") UUID offerId);

    @Query("SELECT p FROM WholesalePool p JOIN FETCH p.offer o JOIN FETCH o.product " +
           "WHERE p.status = com.groupmart.entity.WholesalePoolStatus.OPEN " +
           "OR p.status = com.groupmart.entity.WholesalePoolStatus.ALMOST_COMPLETE")
    List<WholesalePool> findOpenPoolsForMarketplace();

    @Query("SELECT p.id FROM WholesalePool p " +
           "WHERE (p.status = com.groupmart.entity.WholesalePoolStatus.OPEN " +
           "OR p.status = com.groupmart.entity.WholesalePoolStatus.ALMOST_COMPLETE) " +
           "AND p.deadline <= :now")
    List<UUID> findExpiredOpenPoolIds(@Param("now") LocalDateTime now);
}
