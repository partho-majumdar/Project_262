package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.seller.*;
import com.groupmart.entity.OrderItem;
import com.groupmart.entity.Product;
import com.groupmart.entity.Role;
import com.groupmart.entity.SellerStore;
import com.groupmart.entity.User;
import com.groupmart.repository.OrderItemRepository;
import com.groupmart.repository.ProductRepository;
import com.groupmart.repository.SellerStoreRepository;
import com.groupmart.repository.UserRepository;
import com.groupmart.service.SellerService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SellerServiceImpl implements SellerService {

    private final SellerStoreRepository sellerStoreRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final OrderItemRepository orderItemRepository;

    private static final int LOW_STOCK_THRESHOLD = 5;

    @Override
    @Transactional
    public SellerStoreDto createSellerStore(String userEmail, CreateSellerStoreRequest request) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        if (sellerStoreRepository.existsByUserId(user.getId())) {
            throw new ApiException("User already owns a registered seller store", HttpStatus.CONFLICT);
        }

        if (sellerStoreRepository.existsByStoreName(request.getStoreName())) {
            throw new ApiException("Store name '" + request.getStoreName() + "' is already taken", HttpStatus.CONFLICT);
        }

        String slug = generateStoreSlug(request.getStoreName());

        if (user.getRole() == Role.ROLE_CUSTOMER) {
            user.setRole(Role.ROLE_SELLER);
            userRepository.save(user);
        }

        SellerStore store = SellerStore.builder()
                .user(user)
                .storeName(request.getStoreName().trim())
                .storeSlug(slug)
                .description(request.getDescription())
                .logoUrl(request.getLogoUrl())
                .bannerUrl(request.getBannerUrl())
                .taxId(request.getTaxId())
                .verified(false)
                .rating(0.0)
                .totalSales(0)
                .build();

        SellerStore savedStore = sellerStoreRepository.save(store);
        return mapToDto(savedStore);
    }

    @Override
    @Transactional(readOnly = true)
    public SellerStoreDto getSellerStoreByEmail(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        SellerStore store = sellerStoreRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("SellerStore", "userId", user.getId()));

        return mapToDto(store);
    }

    @Override
    @Transactional(readOnly = true)
    public SellerStoreDto getSellerStoreBySlug(String storeSlug) {
        SellerStore store = sellerStoreRepository.findByStoreSlug(storeSlug)
                .orElseThrow(() -> new ResourceNotFoundException("SellerStore", "slug", storeSlug));
        return mapToDto(store);
    }

    @Override
    @Transactional
    public SellerStoreDto updateSellerStore(String userEmail, UpdateSellerStoreRequest request) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        SellerStore store = sellerStoreRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("SellerStore", "userId", user.getId()));

        if (sellerStoreRepository.existsByStoreNameAndIdNot(request.getStoreName(), store.getId())) {
            throw new ApiException(
                    "Store name '" + request.getStoreName() + "' is already taken by another merchant",
                    HttpStatus.CONFLICT);
        }

        store.setStoreName(request.getStoreName().trim());
        store.setStoreSlug(generateStoreSlug(request.getStoreName()));
        store.setDescription(request.getDescription());
        if (request.getLogoUrl() != null) store.setLogoUrl(request.getLogoUrl());
        if (request.getBannerUrl() != null) store.setBannerUrl(request.getBannerUrl());
        if (request.getTaxId() != null) store.setTaxId(request.getTaxId());

        SellerStore updated = sellerStoreRepository.save(store);
        return mapToDto(updated);
    }

    /**
     * LIVE dashboard overview — no hardcoded demo values.
     * Counts products, order items, revenue, and low stock for this seller store.
     */
    @Override
    @Transactional(readOnly = true)
    public SellerDashboardOverviewDto getSellerDashboardOverview(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        SellerStore store = sellerStoreRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("SellerStore", "userId", user.getId()));

        UUID storeId = store.getId();

        // Products belonging to this store
        List<Product> products = productRepository.findBySellerStoreId(storeId);
        int totalProducts = products.size();

        int lowStockAlertCount = (int) products.stream()
                .filter(p -> p.getStockQuantity() <= LOW_STOCK_THRESHOLD)
                .count();

        double averageRating;
        if (products.isEmpty()) {
            averageRating = store.getRating();
        } else {
            averageRating = products.stream()
                    .mapToDouble(Product::getRating)
                    .average()
                    .orElse(store.getRating());
            averageRating = BigDecimal.valueOf(averageRating)
                    .setScale(1, RoundingMode.HALF_UP)
                    .doubleValue();
        }

        // Order items for this store → distinct orders + revenue from line subtotals
        List<OrderItem> items = orderItemRepository.findBySellerStoreIdOrderByCreatedAtDesc(storeId);

        Set<UUID> orderIds = new HashSet<>();
        BigDecimal totalRevenue = BigDecimal.ZERO;

        for (OrderItem item : items) {
            if (item.getOrder() != null && item.getOrder().getId() != null) {
                orderIds.add(item.getOrder().getId());
            }
            if (item.getSubtotal() != null) {
                totalRevenue = totalRevenue.add(item.getSubtotal());
            }
        }

        int totalOrders = orderIds.size();

        // Keep store.totalSales roughly in sync (optional side effect is fine for overview)
        // Not saving here to keep method read-only.

        return SellerDashboardOverviewDto.builder()
                .store(mapToDto(store))
                .totalRevenue(totalRevenue.setScale(2, RoundingMode.HALF_UP))
                .totalOrders(totalOrders)
                .totalProducts(totalProducts)
                .lowStockAlertCount(lowStockAlertCount)
                .averageRating(averageRating)
                .build();
    }

    @Override
    @Transactional
    public SellerStoreDto verifySellerStore(UUID storeId, boolean verify) {
        SellerStore store = sellerStoreRepository.findById(storeId)
                .orElseThrow(() -> new ResourceNotFoundException("SellerStore", "id", storeId));

        store.setVerified(verify);
        SellerStore updated = sellerStoreRepository.save(store);
        return mapToDto(updated);
    }

    private String generateStoreSlug(String name) {
        String baseSlug = name.toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-");

        String slug = baseSlug;
        int count = 1;
        while (sellerStoreRepository.existsByStoreSlug(slug)) {
            slug = baseSlug + "-" + count++;
        }
        return slug;
    }

    private SellerStoreDto mapToDto(SellerStore store) {
        return SellerStoreDto.builder()
                .id(store.getId())
                .userId(store.getUser().getId())
                .ownerName(store.getUser().getFirstName() + " " + store.getUser().getLastName())
                .ownerEmail(store.getUser().getEmail())
                .storeName(store.getStoreName())
                .storeSlug(store.getStoreSlug())
                .description(store.getDescription())
                .logoUrl(store.getLogoUrl())
                .bannerUrl(store.getBannerUrl())
                .taxId(store.getTaxId())
                .verified(store.isVerified())
                .rating(store.getRating())
                .totalSales(store.getTotalSales())
                .createdAt(store.getCreatedAt())
                .build();
    }
}