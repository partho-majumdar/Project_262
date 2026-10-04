package com.groupmart.repository;

import com.groupmart.entity.Auction;
import com.groupmart.entity.AuctionStatus;
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
public interface AuctionRepository extends JpaRepository<Auction, UUID> {

    /**
     * Row-locks the auction so competing bids serialize. Every write path that touches
     * {@code currentPrice} or {@code leadingBidder} must go through this, never a plain
     * {@code findById}, or two simultaneous bids could each read the same leader.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Auction a WHERE a.id = :id")
    Optional<Auction> findByIdForUpdate(@Param("id") UUID id);

    /** Public marketplace: anything a customer is allowed to see, i.e. not a draft. */
    @Query("SELECT a FROM Auction a WHERE a.status <> com.groupmart.entity.AuctionStatus.DRAFT "
            + "ORDER BY CASE a.status WHEN com.groupmart.entity.AuctionStatus.LIVE THEN 0 "
            + "WHEN com.groupmart.entity.AuctionStatus.SCHEDULED THEN 1 ELSE 2 END, a.endsAt ASC")
    List<Auction> findMarketplaceAuctions();

    @Query("SELECT a FROM Auction a WHERE a.sellerStore.id = :sellerStoreId ORDER BY a.createdAt DESC")
    List<Auction> findBySellerStoreIdOrderByCreatedAtDesc(@Param("sellerStoreId") UUID sellerStoreId);

    @Query("SELECT a FROM Auction a WHERE a.product.id = :productId ORDER BY a.createdAt DESC")
    List<Auction> findByProductIdOrderByCreatedAtDesc(@Param("productId") UUID productId);

    @Query("SELECT a FROM Auction a WHERE a.status = :status ORDER BY a.endsAt ASC")
    List<Auction> findByStatusOrderByEndsAtAsc(@Param("status") AuctionStatus status);

    @Query("SELECT a FROM Auction a WHERE a.status IN :statuses ORDER BY a.createdAt DESC")
    List<Auction> findByStatusInOrderByCreatedAtDesc(@Param("statuses") List<AuctionStatus> statuses);

    /** Scheduled auctions whose start time has arrived, promoted to LIVE. */
    @Query("SELECT a FROM Auction a WHERE a.status = com.groupmart.entity.AuctionStatus.SCHEDULED "
            + "AND a.startsAt <= :now")
    List<Auction> findDueToOpen(@Param("now") LocalDateTime now);

    /** Ids of live auctions past their deadline, so the sweeper can close each in its own transaction. */
    @Query("SELECT a.id FROM Auction a WHERE a.status = com.groupmart.entity.AuctionStatus.LIVE "
            + "AND a.endsAt <= :now")
    List<UUID> findExpiredLiveAuctionIds(@Param("now") LocalDateTime now);

    long countByStatus(AuctionStatus status);
}
