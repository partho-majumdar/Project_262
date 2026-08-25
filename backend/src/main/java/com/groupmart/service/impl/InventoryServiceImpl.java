package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.inventory.InventoryLogDto;
import com.groupmart.dto.inventory.InventoryStatusDto;
import com.groupmart.dto.inventory.UpdateStockRequest;
import com.groupmart.entity.InventoryLog;
import com.groupmart.entity.Product;
import com.groupmart.entity.Role;
import com.groupmart.entity.SellerStore;
import com.groupmart.entity.User;
import com.groupmart.repository.InventoryLogRepository;
import com.groupmart.repository.ProductRepository;
import com.groupmart.repository.SellerStoreRepository;
import com.groupmart.repository.UserRepository;
import com.groupmart.service.InventoryService;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InventoryServiceImpl implements InventoryService {

    private final ProductRepository productRepository;
    private final SellerStoreRepository sellerStoreRepository;
    private final UserRepository userRepository;
    private final InventoryLogRepository inventoryLogRepository;

    private static final int DEFAULT_LOW_STOCK_THRESHOLD = 5;

    @Override
    @Transactional(readOnly = true)
    public List<InventoryStatusDto> getSellerInventoryStatus(String sellerEmail) {
        SellerStore store = getSellerStore(sellerEmail);
        List<Product> products = productRepository.findBySellerStoreId(store.getId());

        return products.stream()
                .map(this::mapToInventoryStatus)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<InventoryStatusDto> getLowStockAlerts(String sellerEmail, int threshold) {
        int lowStockThreshold = threshold > 0 ? threshold : DEFAULT_LOW_STOCK_THRESHOLD;
        SellerStore store = getSellerStore(sellerEmail);
        List<Product> products = productRepository.findBySellerStoreId(store.getId());

        return products.stream()
                .filter(p -> p.getStockQuantity() <= lowStockThreshold)
                .map(this::mapToInventoryStatus)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public InventoryStatusDto updateProductStock(String sellerEmail, UUID productId, UpdateStockRequest request) {
        User user = userRepository.findByEmail(sellerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", sellerEmail));

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", productId));

        if (user.getRole() != Role.ROLE_ADMIN) {
            if (product.getSellerStore() == null || !product.getSellerStore().getUser().getId().equals(user.getId())) {
                throw new ApiException("Not authorized to modify inventory for this product", HttpStatus.FORBIDDEN);
            }
        }

        int previousQty = product.getStockQuantity();
        int newQty = previousQty + request.getQuantityChange();

        if (newQty < 0) {
            throw new ApiException("Resulting stock quantity cannot be negative. Current stock: " + previousQty, HttpStatus.BAD_REQUEST);
        }

        product.setStockQuantity(newQty);
        Product updatedProduct = productRepository.save(product);

        InventoryLog log = InventoryLog.builder()
                .product(updatedProduct)
                .sellerStore(updatedProduct.getSellerStore())
                .previousQuantity(previousQty)
                .newQuantity(newQty)
                .quantityChange(request.getQuantityChange())
                .reason(request.getReason())
                .referenceId(request.getReferenceId())
                .build();
        inventoryLogRepository.save(log);

        return mapToInventoryStatus(updatedProduct);
    }

    @Override
    @Transactional(readOnly = true)
    public List<InventoryLogDto> getInventoryLogsByProduct(String sellerEmail, UUID productId) {
        User user = userRepository.findByEmail(sellerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", sellerEmail));

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", productId));

        if (user.getRole() != Role.ROLE_ADMIN) {
            if (product.getSellerStore() == null || !product.getSellerStore().getUser().getId().equals(user.getId())) {
                throw new ApiException("Not authorized to access inventory logs for this product", HttpStatus.FORBIDDEN);
            }
        }

        return inventoryLogRepository.findByProductIdOrderByCreatedAtDesc(productId).stream()
                .map(this::mapToLogDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void reserveStockForOrder(UUID productId, int quantity, String orderId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", productId));

        if (product.getStockQuantity() < quantity) {
            throw new ApiException("Insufficient stock for product '" + product.getName() + "'. Requested: " + quantity + ", Available: " + product.getStockQuantity(), HttpStatus.BAD_REQUEST);
        }

        int previousQty = product.getStockQuantity();
        int newQty = previousQty - quantity;
        product.setStockQuantity(newQty);
        productRepository.save(product);

        InventoryLog log = InventoryLog.builder()
                .product(product)
                .sellerStore(product.getSellerStore())
                .previousQuantity(previousQty)
                .newQuantity(newQty)
                .quantityChange(-quantity)
                .reason("ORDER_DEDUCTION")
                .referenceId(orderId)
                .build();
        inventoryLogRepository.save(log);
    }

    @Override
    @Transactional
    public void releaseStockForCancelledOrder(UUID productId, int quantity, String orderId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", productId));

        int previousQty = product.getStockQuantity();
        int newQty = previousQty + quantity;
        product.setStockQuantity(newQty);
        productRepository.save(product);

        InventoryLog log = InventoryLog.builder()
                .product(product)
                .sellerStore(product.getSellerStore())
                .previousQuantity(previousQty)
                .newQuantity(newQty)
                .quantityChange(quantity)
                .reason("RETURN_RESTOCK")
                .referenceId(orderId)
                .build();
        inventoryLogRepository.save(log);
    }

    private SellerStore getSellerStore(String sellerEmail) {
        User user = userRepository.findByEmail(sellerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", sellerEmail));

        return sellerStoreRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("SellerStore", "userId", user.getId()));
    }

    private InventoryStatusDto mapToInventoryStatus(Product product) {
        return InventoryStatusDto.builder()
                .productId(product.getId())
                .productName(product.getName())
                .productSku(product.getSku())
                .categoryName(product.getCategory().getName())
                .currentStock(product.getStockQuantity())
                .lowStockThreshold(DEFAULT_LOW_STOCK_THRESHOLD)
                .lowStock(product.getStockQuantity() <= DEFAULT_LOW_STOCK_THRESHOLD && product.getStockQuantity() > 0)
                .outOfStock(product.getStockQuantity() <= 0)
                .lastUpdated(product.getUpdatedAt())
                .build();
    }

    private InventoryLogDto mapToLogDto(InventoryLog log) {
        return InventoryLogDto.builder()
                .id(log.getId())
                .productId(log.getProduct().getId())
                .productName(log.getProduct().getName())
                .productSku(log.getProduct().getSku())
                .previousQuantity(log.getPreviousQuantity())
                .newQuantity(log.getNewQuantity())
                .quantityChange(log.getQuantityChange())
                .reason(log.getReason())
                .referenceId(log.getReferenceId())
                .createdAt(log.getCreatedAt())
                .build();
    }
}
