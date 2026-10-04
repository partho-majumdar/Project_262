package com.groupmart.repository;

import com.groupmart.entity.ReverseGroupBuyingParticipation;
import com.groupmart.entity.ReverseGroupBuyingParticipationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReverseGroupBuyingParticipationRepository
        extends JpaRepository<ReverseGroupBuyingParticipation, UUID> {

    List<ReverseGroupBuyingParticipation> findByOfferIdAndStatus(UUID offerId,
                                                                 ReverseGroupBuyingParticipationStatus status);

    List<ReverseGroupBuyingParticipation> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<ReverseGroupBuyingParticipation> findByIdAndUserId(UUID id, UUID userId);

    List<ReverseGroupBuyingParticipation> findByOfferIdOrderByCreatedAtAsc(UUID offerId);

    @Query("SELECT COALESCE(SUM(p.quantity), 0) FROM ReverseGroupBuyingParticipation p " +
           "WHERE p.offer.id = :offerId " +
           "AND p.status = com.groupmart.entity.ReverseGroupBuyingParticipationStatus.PARTICIPATING")
    int sumActiveQuantityByOffer(@Param("offerId") UUID offerId);

    /** One customer's own running demand on an offer, used to enforce their per-customer cap. */
    @Query("SELECT COALESCE(SUM(p.quantity), 0) FROM ReverseGroupBuyingParticipation p " +
           "WHERE p.offer.id = :offerId AND p.user.id = :userId " +
           "AND p.status = com.groupmart.entity.ReverseGroupBuyingParticipationStatus.PARTICIPATING")
    int sumActiveQuantityByOfferAndUser(@Param("offerId") UUID offerId, @Param("userId") UUID userId);
}
