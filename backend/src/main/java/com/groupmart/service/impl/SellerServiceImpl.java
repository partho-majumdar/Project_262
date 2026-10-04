package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.auth.SellerApplicationRequest;
import com.groupmart.dto.seller.*;
import com.groupmart.entity.OrderItem;
import com.groupmart.entity.Product;
import com.groupmart.entity.Role;
import com.groupmart.entity.SellerStatus;
import com.groupmart.entity.SellerStore;
import com.groupmart.entity.User;
import com.groupmart.repository.OrderItemRepository;
import com.groupmart.repository.ProductRepository;
import com.groupmart.repository.SellerStoreRepository;
import com.groupmart.repository.UserRepository;
import com.groupmart.service.SellerService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

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
    public SellerApplicationDto submitSellerApplication(String userEmail, SellerApplicationRequest request) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        if (user.getSellerStatus() == SellerStatus.PENDING) {
            throw new ApiException("A seller application is already pending review", HttpStatus.CONFLICT);
        }

        if (user.getSellerStatus() == SellerStatus.APPROVED) {
            throw new ApiException("You are already an approved seller", HttpStatus.CONFLICT);
        }

        if (sellerStoreRepository.existsByUserId(user.getId())) {
            throw new ApiException("User already owns a registered seller store", HttpStatus.CONFLICT);
        }

        if (sellerStoreRepository.existsByStoreName(request.getStoreName().trim())) {
            throw new ApiException("Store name '" + request.getStoreName() + "' is already taken", HttpStatus.CONFLICT);
        }

        String slug = generateStoreSlug(request.getStoreName());

        SellerStore store = SellerStore.builder()
                .user(user)
                .storeName(request.getStoreName().trim())
                .storeSlug(slug)
                .description(request.getDescription())
                .logoUrl(request.getLogoUrl())
                .bannerUrl(request.getBannerUrl())
                .taxId(request.getTaxId())
                .bankAccount(request.getBankAccount())
                .bankName(request.getBankName())
                .verified(false)
                .rating(0.0)
                .totalSales(0)
                .build();
        SellerStore savedStore = sellerStoreRepository.save(store);

        user.setSellerStatus(SellerStatus.PENDING);
        user.setSellerStatusReason(null);
        user.setSellerReviewedAt(null);
        userRepository.save(user);

        return mapToApplicationDto(user, savedStore);
    }

    @Override
    @Transactional(readOnly = true)
    public SellerApplicationDto getSellerApplicationByEmail(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        SellerStore store = sellerStoreRepository.findByUserId(user.getId()).orElse(null);
        return mapToApplicationDto(user, store);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SellerApplicationDto> getAllSellerApplications() {
        return userRepository.findAll().stream()
                .filter(u -> u.getSellerStatus() != SellerStatus.NONE)
                .map(u -> {
                    SellerStore store = sellerStoreRepository.findByUserId(u.getId()).orElse(null);
                    return mapToApplicationDto(u, store);
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public SellerApplicationDto reviewSellerApplication(UUID userId, SellerStatus decision, String reason, String adminEmail) {
        if (decision != SellerStatus.APPROVED && decision != SellerStatus.REJECTED) {
            throw new ApiException("Decision must be APPROVED or REJECTED", HttpStatus.BAD_REQUEST);
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        if (user.getSellerStatus() != SellerStatus.PENDING) {
            throw new ApiException("No pending seller application for this user", HttpStatus.CONFLICT);
        }

        user.setSellerStatus(decision);
        user.setSellerStatusReason(reason);
        user.setSellerReviewedAt(LocalDateTime.now());
        if (decision == SellerStatus.APPROVED) {
            user.setRole(Role.ROLE_SELLER);
        }
        User saved = userRepository.save(user);

        SellerStore store = sellerStoreRepository.findByUserId(userId).orElse(null);
        if (store != null && decision == SellerStatus.APPROVED) {
            store.setVerified(true);
            store = sellerStoreRepository.save(store);
        }

        return mapToApplicationDto(saved, store);
    }

    @Override
    @Transactional
    public SellerStoreDto createSellerStore(String userEmail, CreateSellerStoreRequest request) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        if (user.getRole() == Role.ROLE_ADMIN) {
            // admins can create stores on behalf of themselves without approval
        } else if (user.getSellerStatus() != SellerStatus.APPROVED) {
            throw new ApiException("Seller application must be approved before opening a store", HttpStatus.FORBIDDEN);
        }

        if (sellerStoreRepository.existsByUserId(user.getId())) {
            throw new ApiException("User already owns a registered seller store", HttpStatus.CONFLICT);
        }

        if (sellerStoreRepository.existsByStoreName(request.getStoreName())) {
            throw new ApiException("Store name '" + request.getStoreName() + "' is already taken", HttpStatus.CONFLICT);
        }

        String slug = generateStoreSlug(request.getStoreName());

        SellerStore store = SellerStore.builder()
                .user(user)
                .storeName(request.getStoreName().trim())
                .storeSlug(slug)
                .description(request.getDescription())
                .logoUrl(request.getLogoUrl())
                .bannerUrl(request.getBannerUrl())
                .taxId(request.getTaxId())
                .verified(user.getRole() == Role.ROLE_ADMIN)
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

        ensureSellerApproved(user);

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

        ensureSellerApproved(user);

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

        if (request.getBankAccount() != null) store.setBankAccount(request.getBankAccount());
        if (request.getBankName() != null) store.setBankName(request.getBankName());
        if (request.getShippingPolicy() != null) store.setShippingPolicy(request.getShippingPolicy());
        if (request.getReturnPolicy() != null) store.setReturnPolicy(request.getReturnPolicy());

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

        ensureSellerApproved(user);

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

        if (verify && store.getUser() != null) {
            User user = store.getUser();
            if (user.getSellerStatus() != SellerStatus.APPROVED) {
                user.setSellerStatus(SellerStatus.APPROVED);
                user.setSellerStatusReason(null);
                user.setSellerReviewedAt(LocalDateTime.now());
            }
            if (user.getRole() != Role.ROLE_SELLER) {
                user.setRole(Role.ROLE_SELLER);
            }
            userRepository.save(user);
        }

        return mapToDto(updated);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PublicSellerStoreDto> getAllPublicSellers() {
        return sellerStoreRepository.findAll().stream()
                .map(this::mapToPublicDto)
                .collect(java.util.stream.Collectors.toList());
    }

    private PublicSellerStoreDto mapToPublicDto(SellerStore store) {
        return PublicSellerStoreDto.builder()
                .id(store.getId())
                .userId(store.getUser().getId())
                .storeName(store.getStoreName())
                .storeSlug(store.getStoreSlug())
                .description(store.getDescription())
                .logoUrl(store.getLogoUrl())
                .verified(store.isVerified())
                .rating(store.getRating())
                .totalSales(store.getTotalSales())
                .createdAt(store.getCreatedAt())
                .build();
    }

    private void ensureSellerApproved(User user) {
        if (user.getRole() == Role.ROLE_ADMIN) return;
        if (user.getSellerStatus() != SellerStatus.APPROVED) {
            throw new ApiException("Seller application must be approved by an administrator before using the merchant portal", HttpStatus.FORBIDDEN);
        }
    }

    private SellerApplicationDto mapToApplicationDto(User user, SellerStore store) {
        return SellerApplicationDto.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .phone(user.getPhone())
                .sellerStatus(user.getSellerStatus())
                .sellerStatusReason(user.getSellerStatusReason())
                .sellerReviewedAt(user.getSellerReviewedAt())
                .submittedAt(store != null ? store.getCreatedAt() : null)
                .store(store != null ? mapToDto(store) : null)
                .build();
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
                .bankAccount(store.getBankAccount())
                .bankName(store.getBankName())
                .shippingPolicy(store.getShippingPolicy())
                .returnPolicy(store.getReturnPolicy())
                .verified(store.isVerified())
                .rating(store.getRating())
                .totalSales(store.getTotalSales())
                .createdAt(store.getCreatedAt())
                .build();
    }
}