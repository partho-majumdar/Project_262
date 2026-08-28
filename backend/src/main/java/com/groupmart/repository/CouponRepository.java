package com.groupmart.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.Coupon;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CouponRepository extends JpaRepository<Coupon, UUID> {

    Optional<Coupon> findByCodeIgnoreCase(String code);

    Optional<Coupon> findByCodeIgnoreCaseAndActiveTrue(String code);

    boolean existsByCodeIgnoreCase(String code);

    List<Coupon> findByActiveTrue();

    List<Coupon> findBySellerStoreIdOrderByCreatedAtDesc(UUID sellerStoreId);

    List<Coupon> findBySellerStoreIsNull();
}
