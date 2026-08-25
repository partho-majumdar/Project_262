package com.groupmart.dto.product;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductDto {

    private UUID id;
    private String name;
    private String sku;
    private String slug;
    private String description;
    private BigDecimal price;
    private BigDecimal compareAtPrice;
    private UUID categoryId;
    private String categoryName;
    private String categorySlug;
    private UUID sellerStoreId;
    private String sellerStoreName;
    private String sellerStoreSlug;
    private int stockQuantity;
    private List<String> imageUrls;
    private double rating;
    private int reviewCount;
    private boolean featured;
    private boolean active;
    private LocalDateTime createdAt;
}
