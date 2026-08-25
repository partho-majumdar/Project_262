package com.groupmart.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.SellerStore;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface SellerStoreRepository extends JpaRepository<SellerStore, UUID> {

    Optional<SellerStore> findByUserId(UUID userId);

    Optional<SellerStore> findByStoreSlug(String storeSlug);

    boolean existsByStoreName(String storeName);

    boolean existsByStoreSlug(String storeSlug);

    boolean existsByUserId(UUID userId);

    boolean existsByStoreNameAndIdNot(String storeName, UUID id);
}
