package com.groupmart.repository;

import com.groupmart.entity.GroupBuyingAuctionTier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface GroupBuyingAuctionTierRepository extends JpaRepository<GroupBuyingAuctionTier, UUID> {

    /** Ascending by threshold: {@code AuctionPricingService} walks this to find the reached tier. */
    List<GroupBuyingAuctionTier> findByAuctionIdOrderByMinQuantityAsc(UUID auctionId);

    void deleteByAuctionId(UUID auctionId);
}
