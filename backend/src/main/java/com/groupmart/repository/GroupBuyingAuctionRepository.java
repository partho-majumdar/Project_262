package com.groupmart.repository;

import com.groupmart.entity.GroupBuyingAuction;
import com.groupmart.entity.GroupBuyingAuctionStatus;
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
public interface GroupBuyingAuctionRepository extends JpaRepository<GroupBuyingAuction, UUID> {

    /** Row-locked read so concurrent bids and finalization serialize on this auction. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM GroupBuyingAuction a WHERE a.id = :id")
    Optional<GroupBuyingAuction> findByIdForUpdate(@Param("id") UUID id);

    List<GroupBuyingAuction> findBySellerStoreIdOrderByCreatedAtDesc(UUID sellerStoreId);

    List<GroupBuyingAuction> findByStatusOrderByCreatedAtDesc(GroupBuyingAuctionStatus status);

    /** Public marketplace: auctions that are open, plus published ones whose start time has arrived. */
    @Query("SELECT a FROM GroupBuyingAuction a JOIN FETCH a.product JOIN FETCH a.sellerStore " +
           "WHERE a.status = com.groupmart.entity.GroupBuyingAuctionStatus.OPEN " +
           "OR (a.status = com.groupmart.entity.GroupBuyingAuctionStatus.SCHEDULED AND a.startsAt <= :now) " +
           "ORDER BY a.endsAt ASC")
    List<GroupBuyingAuction> findLiveAuctionsForMarketplace(@Param("now") LocalDateTime now);

    @Query("SELECT a FROM GroupBuyingAuction a JOIN FETCH a.product JOIN FETCH a.sellerStore WHERE a.id = :id")
    Optional<GroupBuyingAuction> findDetailedById(@Param("id") UUID id);

    /** Published auctions whose start time has arrived. */
    @Query("SELECT a.id FROM GroupBuyingAuction a " +
           "WHERE a.status = com.groupmart.entity.GroupBuyingAuctionStatus.SCHEDULED AND a.startsAt <= :now")
    List<UUID> findDueToOpenIds(@Param("now") LocalDateTime now);

    /** Open auctions past their end time, for the server-side deadline sweep. */
    @Query("SELECT a.id FROM GroupBuyingAuction a " +
           "WHERE a.status = com.groupmart.entity.GroupBuyingAuctionStatus.OPEN AND a.endsAt <= :now")
    List<UUID> findExpiredOpenIds(@Param("now") LocalDateTime now);

    long countBySellerStoreIdAndStatus(UUID storeId, GroupBuyingAuctionStatus status);
}
