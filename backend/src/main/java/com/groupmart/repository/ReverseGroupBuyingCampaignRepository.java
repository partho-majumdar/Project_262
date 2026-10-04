package com.groupmart.repository;

import com.groupmart.entity.ReverseGroupBuyingCampaign;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReverseGroupBuyingCampaignRepository
        extends JpaRepository<ReverseGroupBuyingCampaign, UUID> {

    Optional<ReverseGroupBuyingCampaign> findByOfferId(UUID offerId);

    boolean existsByOfferId(UUID offerId);
}
