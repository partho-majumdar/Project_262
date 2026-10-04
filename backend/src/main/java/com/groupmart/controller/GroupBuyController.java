package com.groupmart.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.groupbuy.*;
import com.groupmart.service.GroupBuyDisputeService;
import com.groupmart.service.GroupBuyService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/group-buys")
@RequiredArgsConstructor
public class GroupBuyController {

    private final GroupBuyService groupBuyService;
    private final GroupBuyDisputeService disputeService;

    @GetMapping("/deals")
    public ResponseEntity<ApiResponse<List<GroupBuyCampaignDto>>> getDeals(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String sort) {
        return ResponseEntity.ok(ApiResponse.success("Group deals retrieved",
                groupBuyService.getActiveDeals(q, category, sort)));
    }

    @GetMapping("/deals/{campaignId}")
    public ResponseEntity<ApiResponse<GroupBuyDealDetailDto>> getDeal(
            @PathVariable UUID campaignId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success("Group deal retrieved",
                groupBuyService.getDeal(campaignId, email(userDetails))));
    }

    @GetMapping("/products/{productId}/deals")
    public ResponseEntity<ApiResponse<List<GroupBuyCampaignDto>>> getDealsForProduct(@PathVariable UUID productId) {
        return ResponseEntity.ok(ApiResponse.success("Product group deals retrieved",
                groupBuyService.getActiveDealsForProduct(productId)));
    }

    @GetMapping("/groups/{groupId}")
    public ResponseEntity<ApiResponse<GroupBuyGroupDto>> getGroup(
            @PathVariable UUID groupId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success("Group retrieved",
                groupBuyService.getGroup(groupId, email(userDetails))));
    }

    @GetMapping("/groups/code/{inviteCode}")
    public ResponseEntity<ApiResponse<GroupBuyGroupDto>> getGroupByInviteCode(
            @PathVariable String inviteCode,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success("Group retrieved",
                groupBuyService.getGroupByInviteCode(inviteCode, email(userDetails))));
    }

    @PostMapping("/deals/{campaignId}/groups")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<GroupBuyGroupDto>> startGroup(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID campaignId,
            @Valid @RequestBody JoinGroupBuyRequest request) {
        GroupBuyGroupDto group = groupBuyService.startGroup(userDetails.getUsername(), campaignId, request);
        return new ResponseEntity<>(
                ApiResponse.success("Group started", group, HttpStatus.CREATED.value()),
                HttpStatus.CREATED);
    }

    @PostMapping("/groups/{groupId}/join")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<GroupBuyGroupDto>> joinGroup(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID groupId,
            @Valid @RequestBody JoinGroupBuyRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Joined group",
                groupBuyService.joinGroup(userDetails.getUsername(), groupId, request)));
    }

    @PostMapping("/groups/{groupId}/leave")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<GroupBuyGroupDto>> leaveGroup(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID groupId) {
        return ResponseEntity.ok(ApiResponse.success("Left group",
                groupBuyService.leaveGroup(userDetails.getUsername(), groupId)));
    }

    @PostMapping("/deals/{campaignId}/follow")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<GroupBuyDealDetailDto>> followDeal(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID campaignId) {
        return ResponseEntity.ok(ApiResponse.success("You're following this deal",
                groupBuyService.followDeal(userDetails.getUsername(), campaignId)));
    }

    @DeleteMapping("/deals/{campaignId}/follow")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<GroupBuyDealDetailDto>> unfollowDeal(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID campaignId) {
        return ResponseEntity.ok(ApiResponse.success("You unfollowed this deal",
                groupBuyService.unfollowDeal(userDetails.getUsername(), campaignId)));
    }

    @GetMapping("/me/followed-deals")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<GroupBuyCampaignDto>>> getFollowedDeals(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success("Followed deals retrieved",
                groupBuyService.getFollowedDeals(userDetails.getUsername())));
    }

    @GetMapping("/me/groups")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<GroupBuyGroupDto>>> getMyGroups(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false, defaultValue = "all") String filter) {
        return ResponseEntity.ok(ApiResponse.success("Your groups retrieved",
                groupBuyService.getMyGroups(userDetails.getUsername(), filter)));
    }

    @GetMapping("/me/stats")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<GroupBuyStatsDto>> getMyStats(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success("Group buy stats retrieved",
                groupBuyService.getMyStats(userDetails.getUsername())));
    }

    @PostMapping("/groups/{groupId}/disputes")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<GroupBuyDisputeDto>> openDispute(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID groupId,
            @Valid @RequestBody GroupBuyDisputeRequest request) {
        GroupBuyDisputeDto dispute = disputeService.openDispute(userDetails.getUsername(), groupId, request);
        return new ResponseEntity<>(
                ApiResponse.success("Your report was sent", dispute, HttpStatus.CREATED.value()),
                HttpStatus.CREATED);
    }

    @GetMapping("/me/disputes")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<GroupBuyDisputeDto>>> getMyDisputes(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success("Your reports retrieved",
                disputeService.getMyDisputes(userDetails.getUsername())));
    }

    private static String email(UserDetails userDetails) {
        return userDetails != null ? userDetails.getUsername() : null;
    }
}
