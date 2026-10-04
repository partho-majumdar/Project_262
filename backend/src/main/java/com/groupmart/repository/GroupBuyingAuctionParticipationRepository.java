package com.groupmart.repository;

import com.groupmart.entity.AuctionParticipationStatus;
import com.groupmart.entity.GroupBuyingAuctionParticipation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GroupBuyingAuctionParticipationRepository
        extends JpaRepository<GroupBuyingAuctionParticipation, UUID> {

    List<GroupBuyingAuctionParticipation> findByAuctionIdAndStatus(UUID auctionId,
                                                                  AuctionParticipationStatus status);

    List<GroupBuyingAuctionParticipation> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<GroupBuyingAuctionParticipation> findByIdAndUserId(UUID id, UUID userId);

    List<GroupBuyingAuctionParticipation> findByAuctionIdOrderByCreatedAtAsc(UUID auctionId);

    @Query("SELECT COALESCE(SUM(b.quantity), 0) FROM GroupBuyingAuctionParticipation b " +
           "WHERE b.auction.id = :auctionId AND b.status = com.groupmart.entity.AuctionParticipationStatus.BID_PLACED")
    int sumActiveQuantityByAuction(@Param("auctionId") UUID auctionId);

    /** One customer's own running bid on an auction, used to enforce their per-customer cap. */
    @Query("SELECT COALESCE(SUM(b.quantity), 0) FROM GroupBuyingAuctionParticipation b " +
           "WHERE b.auction.id = :auctionId AND b.user.id = :userId " +
           "AND b.status = com.groupmart.entity.AuctionParticipationStatus.BID_PLACED")
    int sumActiveQuantityByAuctionAndUser(@Param("auctionId") UUID auctionId, @Param("userId") UUID userId);

    /**
     * How many distinct customers currently hold a live bid.
     * <p>
     * COUNT(DISTINCT user) rather than a count of rows: one customer may hold several bids on the
     * same auction, and the participant count the spec asks for is a headcount of participating
     * customers, not a tally of bid rows.
     */
    @Query("SELECT COUNT(DISTINCT b.user.id) FROM GroupBuyingAuctionParticipation b " +
           "WHERE b.auction.id = :auctionId AND b.status = com.groupmart.entity.AuctionParticipationStatus.BID_PLACED")
    int countDistinctActiveBidders(@Param("auctionId") UUID auctionId);

    /**
     * Units settled as WON on a finalized auction.
     * <p>
     * Read back rather than trusted from the result row, because a result finalized before the
     * aggregate columns existed carries zeroes that will never be rewritten: finalization is
     * one-shot, so a stored figure on an already-terminal auction is never revisited.
     */
    @Query("SELECT COALESCE(SUM(b.quantity), 0) FROM GroupBuyingAuctionParticipation b " +
           "WHERE b.auction.id = :auctionId AND b.status = com.groupmart.entity.AuctionParticipationStatus.WON")
    int sumWonQuantity(@Param("auctionId") UUID auctionId);

    /** Units released by the bidders the clearing price passed over. */
    @Query("SELECT COALESCE(SUM(b.quantity), 0) FROM GroupBuyingAuctionParticipation b " +
           "WHERE b.auction.id = :auctionId AND b.status = com.groupmart.entity.AuctionParticipationStatus.OUTBID")
    int sumOutbidQuantity(@Param("auctionId") UUID auctionId);

    /**
     * Revenue from the winning orders, taken from the orders themselves rather than recomputed.
     * <p>
     * The orders are the record of what was actually charged, so summing them cannot drift from the
     * money that moved.
     */
    @Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM Order o " +
           "WHERE o.groupBuyingAuctionId = :auctionId")
    java.math.BigDecimal sumWonOrderTotals(@Param("auctionId") UUID auctionId);
}
