package com.groupmart.repository;

import com.groupmart.entity.WholesalePurchase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface WholesalePurchaseRepository extends JpaRepository<WholesalePurchase, UUID> {

    Optional<WholesalePurchase> findByPoolId(UUID poolId);
}
