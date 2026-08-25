package com.groupmart.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.InventoryLog;

import java.util.List;
import java.util.UUID;

@Repository
public interface InventoryLogRepository extends JpaRepository<InventoryLog, UUID> {

    List<InventoryLog> findByProductIdOrderByCreatedAtDesc(UUID productId);

    List<InventoryLog> findBySellerStoreIdOrderByCreatedAtDesc(UUID sellerStoreId);
}
