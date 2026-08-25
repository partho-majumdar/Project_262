package com.groupmart.dto.wishlist;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WishlistItemDto {

    private UUID id;
    private UUID productId;
    private String productName;
    private String productSlug;
    private String productSku;
    private String categoryName;
    private String imageUrl;
    private BigDecimal price;
    private BigDecimal compareAtPrice;
    private boolean inStock;
    private LocalDateTime createdAt;
}
