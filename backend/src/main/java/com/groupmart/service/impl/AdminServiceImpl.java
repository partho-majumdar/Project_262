package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.admin.*;
import com.groupmart.dto.seller.SellerStoreDto;
import com.groupmart.entity.AuditLog;
import com.groupmart.entity.Role;
import com.groupmart.entity.SellerStore;
import com.groupmart.entity.User;
import com.groupmart.repository.AuditLogRepository;
import com.groupmart.repository.CategoryRepository;
import com.groupmart.repository.SellerStoreRepository;
import com.groupmart.repository.UserRepository;
import com.groupmart.service.AdminService;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminServiceImpl implements AdminService {

    private final UserRepository userRepository;
    private final SellerStoreRepository sellerStoreRepository;
    private final CategoryRepository categoryRepository;
    private final AuditLogRepository auditLogRepository;

    @Override
    @Transactional(readOnly = true)
    public AdminDashboardOverviewDto getAdminDashboardOverview() {
        long totalUsers = userRepository.count();
        long totalSellers = sellerStoreRepository.count();
        long totalCategories = categoryRepository.count();
        long pendingVerifications = sellerStoreRepository.findAll().stream()
                .filter(s -> !s.isVerified())
                .count();

        List<AuditLogDto> recentLogs = auditLogRepository.findTop20ByOrderByCreatedAtDesc()
                .stream()
                .map(this::mapToAuditLogDto)
                .collect(Collectors.toList());

        return AdminDashboardOverviewDto.builder()
                .totalUsers(totalUsers)
                .totalSellers(totalSellers)
                .totalCategories(totalCategories)
                .totalProducts(0)
                .totalOrders(0)
                .totalPlatformRevenue(new BigDecimal("98450.00"))
                .pendingSellerVerifications(pendingVerifications)
                .recentAuditLogs(recentLogs)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AdminUserSummaryDto> getAllUsers(Pageable pageable) {
        return userRepository.findAll(pageable).map(this::mapToUserSummaryDto);
    }

    @Override
    @Transactional
    public AdminUserSummaryDto updateUserRole(String adminEmail, UUID userId, Role newRole) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        Role oldRole = user.getRole();
        user.setRole(newRole);
        User updated = userRepository.save(user);

        recordAuditLog(
                user.getId(),
                adminEmail,
                "UPDATE_USER_ROLE",
                "USER",
                String.format("Changed role for %s from %s to %s", user.getEmail(), oldRole, newRole)
        );

        return mapToUserSummaryDto(updated);
    }

    @Override
    @Transactional
    public AdminUserSummaryDto toggleUserStatus(String adminEmail, UUID userId, boolean enabled) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        user.setEnabled(enabled);
        User updated = userRepository.save(user);

        recordAuditLog(
                user.getId(),
                adminEmail,
                enabled ? "ENABLE_USER" : "DISABLE_USER",
                "USER",
                String.format("Toggled account enabled status to %s for user %s", enabled, user.getEmail())
        );

        return mapToUserSummaryDto(updated);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SellerStoreDto> getAllSellerStores() {
        return sellerStoreRepository.findAll().stream()
                .map(this::mapToSellerStoreDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditLogDto> getAuditLogs(Pageable pageable) {
        return auditLogRepository.findAllByOrderByCreatedAtDesc(pageable).map(this::mapToAuditLogDto);
    }

    @Override
    @Transactional
    public void recordAuditLog(UUID userId, String userEmail, String action, String resource, String details) {
        AuditLog log = AuditLog.builder()
                .userId(userId)
                .userEmail(userEmail)
                .action(action)
                .resource(resource)
                .details(details)
                .ipAddress("127.0.0.1")
                .build();
        auditLogRepository.save(log);
    }

    private AdminUserSummaryDto mapToUserSummaryDto(User user) {
        Optional<SellerStore> storeOpt = sellerStoreRepository.findByUserId(user.getId());
        return AdminUserSummaryDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .phone(user.getPhone())
                .role(user.getRole())
                .enabled(user.isEnabled())
                .storeName(storeOpt.map(SellerStore::getStoreName).orElse(null))
                .createdAt(user.getCreatedAt())
                .build();
    }

    private SellerStoreDto mapToSellerStoreDto(SellerStore store) {
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

    private AuditLogDto mapToAuditLogDto(AuditLog log) {
        return AuditLogDto.builder()
                .id(log.getId())
                .userId(log.getUserId())
                .userEmail(log.getUserEmail())
                .action(log.getAction())
                .resource(log.getResource())
                .details(log.getDetails())
                .ipAddress(log.getIpAddress())
                .createdAt(log.getCreatedAt())
                .build();
    }
}
