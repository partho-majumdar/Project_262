package com.groupmart.repository;

import com.groupmart.entity.ReverseGroupBuyingOffer;
import com.groupmart.entity.ReverseGroupBuyingOfferStatus;
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
public interface ReverseGroupBuyingOfferRepository extends JpaRepository<ReverseGroupBuyingOffer, UUID> {

    /**
     * Row-locked read used inside the participation transaction so concurrent customers serialize on
     * this offer instead of racing past availableQuantity or the target condition.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM ReverseGroupBuyingOffer o WHERE o.id = :id")
    Optional<ReverseGroupBuyingOffer> findByIdForUpdate(@Param("id") UUID id);

    List<ReverseGroupBuyingOffer> findBySellerStoreIdOrderByCreatedAtDesc(UUID sellerStoreId);

    List<ReverseGroupBuyingOffer> findByStatusOrderByCreatedAtDesc(ReverseGroupBuyingOfferStatus status);

    /** Public marketplace: every offer still collecting demand. */
    @Query("SELECT o FROM ReverseGroupBuyingOffer o JOIN FETCH o.product JOIN FETCH o.sellerStore " +
           "WHERE o.status IN (com.groupmart.entity.ReverseGroupBuyingOfferStatus.OPEN, " +
           "com.groupmart.entity.ReverseGroupBuyingOfferStatus.ALMOST_COMPLETE) " +
           "ORDER BY o.participationDeadline ASC")
    List<ReverseGroupBuyingOffer> findOpenOffersForMarketplace();

    @Query("SELECT o FROM ReverseGroupBuyingOffer o JOIN FETCH o.product JOIN FETCH o.sellerStore " +
           "WHERE o.id = :id")
    Optional<ReverseGroupBuyingOffer> findDetailedById(@Param("id") UUID id);

    /** Offers whose participation deadline has passed without the target condition being met. */
    @Query("SELECT o.id FROM ReverseGroupBuyingOffer o " +
           "WHERE (o.status = com.groupmart.entity.ReverseGroupBuyingOfferStatus.OPEN " +
           "OR o.status = com.groupmart.entity.ReverseGroupBuyingOfferStatus.ALMOST_COMPLETE) " +
           "AND o.participationDeadline <= :now")
    List<UUID> findExpiredOpenOfferIds(@Param("now") LocalDateTime now);

    long countBySellerStoreIdAndStatus(UUID storeId, ReverseGroupBuyingOfferStatus status);
}
