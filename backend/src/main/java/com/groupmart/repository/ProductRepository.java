package com.groupmart.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.Product;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductRepository extends JpaRepository<Product, UUID>, JpaSpecificationExecutor<Product> {

    Optional<Product> findBySlug(String slug);

    Optional<Product> findBySku(String sku);

    List<Product> findBySellerStoreId(UUID sellerStoreId);

    List<Product> findByCategoryIdAndActiveTrue(UUID categoryId);

    List<Product> findByCategorySlugAndActiveTrue(String categorySlug);

    List<Product> findByFeaturedTrueAndActiveTrue();

    boolean existsBySku(String sku);

    boolean existsBySlug(String slug);

    boolean existsByNameAndIdNot(String name, UUID id);

    @Query("SELECT p FROM Product p WHERE p.active = true AND p.compareAtPrice IS NOT NULL AND p.compareAtPrice > p.price ORDER BY (p.compareAtPrice - p.price) DESC")
    Page<Product> findDealsProducts(Pageable pageable);

    @Query("SELECT p FROM Product p WHERE p.active = true ORDER BY p.createdAt DESC")
    Page<Product> findNewArrivalsProducts(Pageable pageable);

    @Query("SELECT p FROM Product p WHERE p.active = true ORDER BY p.rating DESC, p.reviewCount DESC")
    Page<Product> findTrendingProducts(Pageable pageable);

    @Query("SELECT p FROM Product p WHERE p.active = true AND " +
           "(:query IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(p.description) LIKE LOWER(CONCAT('%', :query, '%'))) AND " +
           "(:categorySlug IS NULL OR p.category.slug = :categorySlug) AND " +
           "(:minPrice IS NULL OR p.price >= :minPrice) AND " +
           "(:maxPrice IS NULL OR p.price <= :maxPrice)")
    Page<Product> filterProducts(
            @Param("query") String query,
            @Param("categorySlug") String categorySlug,
            @Param("minPrice") Double minPrice,
            @Param("maxPrice") Double maxPrice,
            Pageable pageable
    );
}
