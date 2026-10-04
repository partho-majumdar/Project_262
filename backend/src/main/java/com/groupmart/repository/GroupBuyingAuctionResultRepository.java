package com.groupmart.repository;

import com.groupmart.entity.GroupBuyingAuctionResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface GroupBuyingAuctionResultRepository extends JpaRepository<GroupBuyingAuctionResult, UUID> {

    Optional<GroupBuyingAuctionResult> findByAuctionId(UUID auctionId);

    boolean existsByAuctionId(UUID auctionId);
}
