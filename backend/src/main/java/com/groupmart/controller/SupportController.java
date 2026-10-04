package com.groupmart.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.support.SendSupportMessageRequest;
import com.groupmart.dto.support.SupportMessageDto;
import com.groupmart.service.SupportService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/support")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class SupportController {

    private final SupportService supportService;

    @GetMapping("/conversations")
    public ResponseEntity<ApiResponse<List<SupportMessageDto>>> getConversations(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        List<SupportMessageDto> conversations = supportService.getConversationPartners(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Support conversations retrieved", conversations));
    }

    @GetMapping("/seller/customers")
    public ResponseEntity<ApiResponse<List<SupportMessageDto>>> getSellerCustomerConversations(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        List<SupportMessageDto> conversations = supportService.getCustomerConversations(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Customer conversations retrieved", conversations));
    }

    @GetMapping("/inbox")
    public ResponseEntity<ApiResponse<List<SupportMessageDto>>> getInbox(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        List<SupportMessageDto> messages = supportService.getInbox(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Inbox retrieved", messages));
    }

    @GetMapping("/sent")
    public ResponseEntity<ApiResponse<List<SupportMessageDto>>> getSent(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        List<SupportMessageDto> messages = supportService.getSent(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Sent messages retrieved", messages));
    }

    @GetMapping("/conversation/{partnerId}")
    public ResponseEntity<ApiResponse<List<SupportMessageDto>>> getConversation(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID partnerId
    ) {
        List<SupportMessageDto> messages = supportService.getConversation(userDetails.getUsername(), partnerId);
        return ResponseEntity.ok(ApiResponse.success("Conversation retrieved", messages));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<Long>> getUnreadCount(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        long count = supportService.getUnreadCount(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Unread count retrieved", count));
    }

    @PostMapping("/send")
    public ResponseEntity<ApiResponse<SupportMessageDto>> sendMessage(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody SendSupportMessageRequest request
    ) {
        SupportMessageDto message = supportService.sendMessage(userDetails.getUsername(), request);
        return ResponseEntity.ok(ApiResponse.success("Support message sent", message));
    }

    @PutMapping("/{messageId}/read")
    public ResponseEntity<ApiResponse<SupportMessageDto>> markAsRead(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID messageId
    ) {
        SupportMessageDto updated = supportService.markAsRead(userDetails.getUsername(), messageId);
        return ResponseEntity.ok(ApiResponse.success("Message marked as read", updated));
    }
}
