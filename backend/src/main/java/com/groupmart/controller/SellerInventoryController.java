package com.groupmart.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.inventory.InventoryLogDto;
import com.groupmart.dto.inventory.InventoryStatusDto;
import com.groupmart.dto.inventory.UpdateStockRequest;
import com.groupmart.service.InventoryService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/seller/inventory")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SELLER', 'ADMIN')")
public class SellerInventoryController {

    private final InventoryService inventoryService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<InventoryStatusDto>>> getInventoryStatus(@AuthenticationPrincipal UserDetails userDetails) {
        List<InventoryStatusDto> inventory = inventoryService.getSellerInventoryStatus(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Merchant inventory status retrieved", inventory));
    }

    @GetMapping("/low-stock")
    public ResponseEntity<ApiResponse<List<InventoryStatusDto>>> getLowStockAlerts(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "5") int threshold
    ) {
        List<InventoryStatusDto> alerts = inventoryService.getLowStockAlerts(userDetails.getUsername(), threshold);
        return ResponseEntity.ok(ApiResponse.success("Low stock alerts retrieved", alerts));
    }

    @PutMapping("/products/{productId}/stock")
    public ResponseEntity<ApiResponse<InventoryStatusDto>> updateProductStock(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID productId,
            @Valid @RequestBody UpdateStockRequest request
    ) {
        InventoryStatusDto updated = inventoryService.updateProductStock(userDetails.getUsername(), productId, request);
        return ResponseEntity.ok(ApiResponse.success("Inventory stock updated successfully", updated));
    }

    @GetMapping("/products/{productId}/logs")
    public ResponseEntity<ApiResponse<List<InventoryLogDto>>> getInventoryLogs(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID productId
    ) {
        List<InventoryLogDto> logs = inventoryService.getInventoryLogsByProduct(userDetails.getUsername(), productId);
        return ResponseEntity.ok(ApiResponse.success("Inventory logs fetched", logs));
    }
}
