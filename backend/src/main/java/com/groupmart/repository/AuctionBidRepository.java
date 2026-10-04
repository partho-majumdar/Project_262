package com.groupmart.repository;

import com.groupmart.entity.AuctionBid;
import com.groupmart.entity.AuctionBidStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AuctionBidRepository extends JpaRepository<AuctionBid, UUID> {

    Optional<AuctionBid> findByAuctionIdAndBidderId(UUID auctionId, UUID bidderId);

    List<AuctionBid> findByAuctionIdOrderByPlacedAtAsc(UUID auctionId);

    List<AuctionBid> findByBidderIdOrderByCreatedAtDesc(UUID bidderId);

    /** Scoped to the caller, so one customer can never touch another customer's bid. */
    @Query("SELECT b FROM AuctionBid b WHERE b.id = :bidId AND b.bidder.id = :bidderId")
    Optional<AuctionBid> findByIdAndBidderId(@Param("bidId") UUID bidId, @Param("bidderId") UUID bidderId);

    @Query("SELECT b FROM AuctionBid b WHERE b.auction.id = :auctionId AND b.bidder.id = :bidderId")
    Optional<AuctionBid> findByAuctionAndBidder(@Param("auctionId") UUID auctionId,
                                                @Param("bidderId") UUID bidderId);

    /**
     * The eligible bids of one auction, ranked for the proxy engine: highest private maximum first,
     * and on an exact tie the bid that was placed first. The tie-break is what makes the winner
     * deterministic when two customers submit the same maximum.
     */
    @Query("SELECT b FROM AuctionBid b WHERE b.auction.id = :auctionId AND b.status IN "
            + "(com.groupmart.entity.AuctionBidStatus.ACTIVE, com.groupmart.entity.AuctionBidStatus.WINNING, "
            + "com.groupmart.entity.AuctionBidStatus.OUTBID) "
            + "ORDER BY b.maximumBid DESC, b.placedAt ASC, b.id ASC")
    List<AuctionBid> findEligibleBidsRanked(@Param("auctionId") UUID auctionId);

    @Query("SELECT b FROM AuctionBid b WHERE b.auction.id = :auctionId AND b.status IN "
            + "(com.groupmart.entity.AuctionBidStatus.ACTIVE, com.groupmart.entity.AuctionBidStatus.WINNING, "
            + "com.groupmart.entity.AuctionBidStatus.OUTBID) "
            + "ORDER BY b.placedAt DESC")
    List<AuctionBid> findEligibleBidsNewestFirst(@Param("auctionId") UUID auctionId);

    @Query("SELECT COUNT(b) FROM AuctionBid b WHERE b.auction.id = :auctionId AND b.status <> "
            + "com.groupmart.entity.AuctionBidStatus.CANCELLED")
    long countActiveBids(@Param("auctionId") UUID auctionId);

    List<AuctionBid> findByAuctionIdAndStatus(UUID auctionId, AuctionBidStatus status);

    /** Distinct bidders who ever bid, so the seller view can count them. */
    @Query("SELECT COUNT(DISTINCT b.bidder.id) FROM AuctionBid b WHERE b.auction.id = :auctionId")
    long countDistinctBidders(@Param("auctionId") UUID auctionId);

    @Query("SELECT b FROM AuctionBid b WHERE b.auction.id = :auctionId AND b.status = "
            + "com.groupmart.entity.AuctionBidStatus.WON")
    List<AuctionBid> findWinningBids(@Param("auctionId") UUID auctionId);
}
