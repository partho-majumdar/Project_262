package com.groupmart.repository;

import com.groupmart.entity.WholesaleOffer;
import com.groupmart.entity.WholesaleOfferStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface WholesaleOfferRepository extends JpaRepository<WholesaleOffer, UUID> {

    List<WholesaleOffer> findBySellerStoreIdOrderByCreatedAtDesc(UUID sellerStoreId);

    List<WholesaleOffer> findByStatusOrderByCreatedAtDesc(WholesaleOfferStatus status);

    @Query("SELECT o FROM WholesaleOffer o JOIN FETCH o.product JOIN FETCH o.sellerStore " +
           "WHERE o.status = com.groupmart.entity.WholesaleOfferStatus.ACTIVE")
    List<WholesaleOffer> findActiveOffersForMarketplace();

    long countBySellerStoreIdAndStatus(UUID storeId, WholesaleOfferStatus status);

    /**
     * Offers still advertising themselves as live once their reservation deadline has passed.
     * The scheduler closes these so a seller's list cannot show a dead offer as Live.
     */
    @Query("SELECT o.id FROM WholesaleOffer o " +
           "WHERE o.status IN (com.groupmart.entity.WholesaleOfferStatus.ACTIVE, com.groupmart.entity.WholesaleOfferStatus.PAUSED) " +
           "AND o.reservationDeadline <= :now")
    List<UUID> findExpiredOpenOfferIds(@Param("now") LocalDateTime now);
}
