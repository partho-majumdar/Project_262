package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import com.groupmart.common.exception.ApiException;
import com.groupmart.entity.InventoryLog;
import com.groupmart.entity.Product;
import com.groupmart.entity.SellerStore;
import com.groupmart.repository.InventoryLogRepository;
import com.groupmart.repository.ProductRepository;

/**
 * Incremental stock reservation for the collective purchasing mechanisms (Reverse Group Buying and
 * Group Buying Auctions).
 * <p>
 * Unlike CWP, which reserves a whole lot's capacity the moment a pool opens, these mechanisms reserve
 * only what each individual customer actually claims, and give it straight back when that claim is
 * withdrawn. The actual protection comes from the shared
 * {@code ProductRepository.decrementStockIfAvailable} atomic update, so concurrent claims can never
 * oversell; this class only adds the inventory audit trail.
 */
@Component
@RequiredArgsConstructor
public class ReservedStockManager {

    private final ProductRepository productRepository;
    private final InventoryLogRepository inventoryLogRepository;

    /**
     * Atomically takes {@code quantity} units out of sellable stock.
     *
     * @throws ApiException when there is not enough stock, without ever going negative
     */
    public void reserve(Product product, SellerStore sellerStore, int quantity, String reason, String referenceId) {
        Integer before = productRepository.findStockQuantityById(product.getId());
        if (productRepository.decrementStockIfAvailable(product.getId(), quantity) == 0) {
            throw new ApiException("Not enough stock for '" + product.getName() + "': this needs " + quantity
                    + " unit(s) but only " + (before == null ? 0 : before) + " are available",
                    HttpStatus.BAD_REQUEST);
        }
        int previous = before == null ? 0 : before;
        inventoryLogRepository.save(InventoryLog.builder()
                .product(product)
                .sellerStore(sellerStore)
                .previousQuantity(previous)
                .newQuantity(previous - quantity)
                .quantityChange(-quantity)
                .reason(reason)
                .referenceId(referenceId)
                .build());
    }

    /** Returns previously reserved units to sellable stock. */
    public void release(Product product, SellerStore sellerStore, int quantity, String reason, String referenceId) {
        if (quantity <= 0) {
            return;
        }
        Integer before = productRepository.findStockQuantityById(product.getId());
        productRepository.incrementStock(product.getId(), quantity);
        int previous = before == null ? 0 : before;
        inventoryLogRepository.save(InventoryLog.builder()
                .product(product)
                .sellerStore(sellerStore)
                .previousQuantity(previous)
                .newQuantity(previous + quantity)
                .quantityChange(quantity)
                .reason(reason)
                .referenceId(referenceId)
                .build());
    }
}
