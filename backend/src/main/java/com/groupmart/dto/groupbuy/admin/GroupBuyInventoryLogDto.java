package com.groupmart.dto.groupbuy.admin;

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
public class GroupBuyInventoryLogDto {

    private UUID id;
    private UUID productId;
    private String productName;
    private String sellerStoreName;
    private int previousQuantity;
    private int newQuantity;
    private int quantityChange;
    private String reason;
    private UUID campaignId;
    private LocalDateTime createdAt;
}
