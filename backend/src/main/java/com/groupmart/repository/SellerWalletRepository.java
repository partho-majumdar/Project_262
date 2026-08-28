package com.groupmart.repository;

import com.groupmart.entity.SellerWallet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface SellerWalletRepository extends JpaRepository<SellerWallet, UUID> {

    Optional<SellerWallet> findBySellerStoreId(UUID sellerStoreId);

    boolean existsBySellerStoreId(UUID sellerStoreId);
}
