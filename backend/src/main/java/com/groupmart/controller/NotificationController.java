package com.groupmart.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.notification.NotificationDto;
import com.groupmart.dto.notification.NotificationPreferenceDto;
import com.groupmart.service.NotificationService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<NotificationDto>>> getUserNotifications(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "50") int limit) {
        List<NotificationDto> notifications = notificationService.getUserNotifications(userDetails.getUsername(), limit);
        return ResponseEntity.ok(ApiResponse.success("Notifications retrieved", notifications));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<Long>> getUnreadCount(@AuthenticationPrincipal UserDetails userDetails) {
        long count = notificationService.getUnreadCount(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Unread count retrieved", count));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<ApiResponse<NotificationDto>> markAsRead(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id
    ) {
        NotificationDto updated = notificationService.markAsRead(userDetails.getUsername(), id);
        return ResponseEntity.ok(ApiResponse.success("Notification marked as read", updated));
    }

    @PutMapping("/read-all")
    public ResponseEntity<ApiResponse<Void>> markAllAsRead(@AuthenticationPrincipal UserDetails userDetails) {
        notificationService.markAllAsRead(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("All notifications marked as read", null));
    }

    @PutMapping("/categories/{category}/read")
    public ResponseEntity<ApiResponse<Void>> markCategoryAsRead(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String category
    ) {
        notificationService.markCategoryAsRead(userDetails.getUsername(), category);
        return ResponseEntity.ok(ApiResponse.success("Notifications marked as read", null));
    }

    @GetMapping("/preferences")
    public ResponseEntity<ApiResponse<List<NotificationPreferenceDto>>> getPreferences(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success("Notification preferences retrieved",
                notificationService.getPreferences(userDetails.getUsername())));
    }

    /** Body maps category keys to enabled flags, e.g. {"DEAL_ALERTS": false}. */
    @PutMapping("/preferences")
    public ResponseEntity<ApiResponse<List<NotificationPreferenceDto>>> updatePreferences(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Boolean> changes) {
        return ResponseEntity.ok(ApiResponse.success("Notification preferences updated",
                notificationService.updatePreferences(userDetails.getUsername(), changes)));
    }
}
