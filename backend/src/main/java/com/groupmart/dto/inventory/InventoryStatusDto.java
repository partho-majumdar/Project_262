package com.groupmart.dto.inventory;

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
public class InventoryStatusDto {

    private UUID productId;
    private String productName;
    private String productSku;
    private String categoryName;
    private int currentStock;
    private int lowStockThreshold;
    private boolean lowStock;
    private boolean outOfStock;
    private LocalDateTime lastUpdated;
}
