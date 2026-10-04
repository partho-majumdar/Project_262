package com.groupmart.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.GroupBuyDealFollow;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GroupBuyDealFollowRepository extends JpaRepository<GroupBuyDealFollow, UUID> {

    Optional<GroupBuyDealFollow> findByCampaignIdAndUserId(UUID campaignId, UUID userId);

    boolean existsByCampaignIdAndUserId(UUID campaignId, UUID userId);

    long countByCampaignId(UUID campaignId);

    List<GroupBuyDealFollow> findByCampaignId(UUID campaignId);

    List<GroupBuyDealFollow> findByUserIdOrderByCreatedAtDesc(UUID userId);
}
