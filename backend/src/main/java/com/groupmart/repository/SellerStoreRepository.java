package com.groupmart.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.SellerStore;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface SellerStoreRepository extends JpaRepository<SellerStore, UUID> {

    @Query("SELECT s FROM SellerStore s JOIN FETCH s.user WHERE s.user.id = :userId")
    Optional<SellerStore> findByUserId(@Param("userId") UUID userId);

    @Query("SELECT CASE WHEN COUNT(s) > 0 THEN true ELSE false END FROM SellerStore s WHERE s.user.id = :userId")
    boolean existsByUserId(@Param("userId") UUID userId);

    Optional<SellerStore> findByStoreSlug(String storeSlug);

    boolean existsByStoreName(String storeName);

    boolean existsByStoreSlug(String storeSlug);

    boolean existsByStoreNameAndIdNot(String storeName, UUID id);
}



// package com.groupmart.repository;

// import org.springframework.data.jpa.repository.JpaRepository;
// import org.springframework.stereotype.Repository;

// import com.groupmart.entity.SellerStore;

// import java.util.Optional;
// import java.util.UUID;

// @Repository
// public interface SellerStoreRepository extends JpaRepository<SellerStore, UUID> {

//     Optional<SellerStore> findByUserId(UUID userId);

//     Optional<SellerStore> findByStoreSlug(String storeSlug);

//     boolean existsByStoreName(String storeName);

//     boolean existsByStoreSlug(String storeSlug);

//     boolean existsByUserId(UUID userId);

//     boolean existsByStoreNameAndIdNot(String storeName, UUID id);
// }
