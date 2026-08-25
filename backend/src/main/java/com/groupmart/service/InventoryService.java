package com.groupmart.service;

import java.util.List;
import java.util.UUID;

import com.groupmart.dto.inventory.InventoryLogDto;
import com.groupmart.dto.inventory.InventoryStatusDto;
import com.groupmart.dto.inventory.UpdateStockRequest;

public interface InventoryService {

    List<InventoryStatusDto> getSellerInventoryStatus(String sellerEmail);

    List<InventoryStatusDto> getLowStockAlerts(String sellerEmail, int threshold);

    InventoryStatusDto updateProductStock(String sellerEmail, UUID productId, UpdateStockRequest request);

    List<InventoryLogDto> getInventoryLogsByProduct(String sellerEmail, UUID productId);

    void reserveStockForOrder(UUID productId, int quantity, String orderId);

    void releaseStockForCancelledOrder(UUID productId, int quantity, String orderId);
}
