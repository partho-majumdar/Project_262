package com.groupmart.dto.seller;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublicSellerStoreDto {

    private UUID id;
    private UUID userId;
    private String storeName;
    private String storeSlug;
    private String description;
    private String logoUrl;
    private boolean verified;
    private double rating;
    private int totalSales;
    private LocalDateTime createdAt;
}
