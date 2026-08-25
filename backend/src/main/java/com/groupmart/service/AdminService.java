package com.groupmart.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.groupmart.dto.admin.*;
import com.groupmart.dto.seller.SellerStoreDto;
import com.groupmart.entity.Role;

import java.util.List;
import java.util.UUID;

public interface AdminService {

    AdminDashboardOverviewDto getAdminDashboardOverview();

    Page<AdminUserSummaryDto> getAllUsers(Pageable pageable);

    AdminUserSummaryDto updateUserRole(String adminEmail, UUID userId, Role newRole);

    AdminUserSummaryDto toggleUserStatus(String adminEmail, UUID userId, boolean enabled);

    List<SellerStoreDto> getAllSellerStores();

    Page<AuditLogDto> getAuditLogs(Pageable pageable);

    void recordAuditLog(UUID userId, String userEmail, String action, String resource, String details);
}
