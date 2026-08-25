package com.groupmart.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.admin.*;
import com.groupmart.dto.order.OrderDto;
import com.groupmart.dto.seller.SellerStoreDto;
import com.groupmart.service.AdminService;
import com.groupmart.service.OrderService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;
    private final OrderService orderService;

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<AdminDashboardOverviewDto>> getDashboardOverview() {
        AdminDashboardOverviewDto overview = adminService.getAdminDashboardOverview();
        return ResponseEntity.ok(ApiResponse.success("Admin dashboard overview fetched", overview));
    }

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<Page<AdminUserSummaryDto>>> getAllUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Page<AdminUserSummaryDto> users = adminService.getAllUsers(PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success("User list retrieved", users));
    }

    @PutMapping("/users/{userId}/role")
    public ResponseEntity<ApiResponse<AdminUserSummaryDto>> updateUserRole(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID userId,
            @Valid @RequestBody UpdateUserRoleRequest request
    ) {
        AdminUserSummaryDto updated = adminService.updateUserRole(userDetails.getUsername(), userId, request.getRole());
        return ResponseEntity.ok(ApiResponse.success("User role updated successfully", updated));
    }

    @PutMapping("/users/{userId}/status")
    public ResponseEntity<ApiResponse<AdminUserSummaryDto>> toggleUserStatus(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID userId,
            @RequestParam boolean enabled
    ) {
        AdminUserSummaryDto updated = adminService.toggleUserStatus(userDetails.getUsername(), userId, enabled);
        return ResponseEntity.ok(ApiResponse.success("User account status updated", updated));
    }

    @GetMapping("/sellers")
    public ResponseEntity<ApiResponse<List<SellerStoreDto>>> getAllSellerStores() {
        List<SellerStoreDto> sellers = adminService.getAllSellerStores();
        return ResponseEntity.ok(ApiResponse.success("Seller store list fetched", sellers));
    }

    @GetMapping("/orders")
    public ResponseEntity<ApiResponse<List<OrderDto>>> getAllOrders() {
        List<OrderDto> orders = orderService.getAllOrdersForAdmin();
        return ResponseEntity.ok(ApiResponse.success("All system orders retrieved", orders));
    }
}
