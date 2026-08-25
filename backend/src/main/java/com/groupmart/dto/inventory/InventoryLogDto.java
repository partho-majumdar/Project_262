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
public class InventoryLogDto {

    private UUID id;
    private UUID productId;
    private String productName;
    private String productSku;
    private int previousQuantity;
    private int newQuantity;
    private int quantityChange;
    private String reason;
    private String referenceId;
    private LocalDateTime createdAt;
}
