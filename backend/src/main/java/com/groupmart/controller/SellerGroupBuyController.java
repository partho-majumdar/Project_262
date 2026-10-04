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
import com.groupmart.dto.groupbuy.GroupBuyCampaignDto;
import com.groupmart.dto.groupbuy.GroupBuyCampaignRequest;
import com.groupmart.dto.groupbuy.GroupBuyGroupDto;
import com.groupmart.dto.groupbuy.GroupBuyReasonRequest;
import com.groupmart.dto.groupbuy.GroupBuyUnitCostRequest;
import com.groupmart.dto.groupbuy.analytics.GroupBuyAnalyticsDto;
import com.groupmart.service.GroupBuyAnalyticsService;
import com.groupmart.service.GroupBuyCampaignService;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/seller/group-buys")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SELLER', 'ADMIN')")
public class SellerGroupBuyController {

    private final GroupBuyCampaignService campaignService;
    private final GroupBuyAnalyticsService analyticsService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<GroupBuyCampaignDto>>> getCampaigns(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.success("Group buy campaigns retrieved",
                campaignService.getSellerCampaigns(userDetails.getUsername())));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<GroupBuyCampaignDto>> getCampaign(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Group buy campaign retrieved",
                campaignService.getSellerCampaign(userDetails.getUsername(), id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<GroupBuyCampaignDto>> createCampaign(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody GroupBuyCampaignRequest request) {
        GroupBuyCampaignDto created = campaignService.createCampaign(userDetails.getUsername(), request);
        return new ResponseEntity<>(
                ApiResponse.success("Group buy saved as draft", created, HttpStatus.CREATED.value()),
                HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<GroupBuyCampaignDto>> updateCampaign(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody GroupBuyCampaignRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Group buy updated",
                campaignService.updateCampaign(userDetails.getUsername(), id, request)));
    }

    @PostMapping("/{id}/publish")
    public ResponseEntity<ApiResponse<GroupBuyCampaignDto>> publish(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Group buy published",
                campaignService.publishCampaign(userDetails.getUsername(), id)));
    }

    @PostMapping("/{id}/pause")
    public ResponseEntity<ApiResponse<GroupBuyCampaignDto>> pause(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Group buy paused",
                campaignService.pauseCampaign(userDetails.getUsername(), id)));
    }

    @PostMapping("/{id}/resume")
    public ResponseEntity<ApiResponse<GroupBuyCampaignDto>> resume(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Group buy resumed",
                campaignService.resumeCampaign(userDetails.getUsername(), id)));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<GroupBuyCampaignDto>> cancel(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) GroupBuyReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Group buy cancelled",
                campaignService.cancelCampaign(userDetails.getUsername(), id,
                        request != null ? request.getReason() : null)));
    }

    @GetMapping("/analytics")
    public ResponseEntity<ApiResponse<GroupBuyAnalyticsDto>> getAnalytics(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(ApiResponse.success("Group buy analytics generated",
                analyticsService.getSellerAnalytics(userDetails.getUsername(), days)));
    }

    @PutMapping("/{id}/unit-cost")
    public ResponseEntity<ApiResponse<GroupBuyUnitCostRequest>> updateUnitCost(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody GroupBuyUnitCostRequest request) {
        BigDecimal saved = campaignService.updateUnitCost(userDetails.getUsername(), id, request.getUnitCost());
        return ResponseEntity.ok(ApiResponse.success(saved != null ? "Unit cost saved" : "Unit cost cleared",
                GroupBuyUnitCostRequest.builder().campaignId(id).unitCost(saved).build()));
    }

    @GetMapping("/{id}/groups")
    public ResponseEntity<ApiResponse<List<GroupBuyGroupDto>>> getGroups(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Campaign groups retrieved",
                campaignService.getSellerCampaignGroups(userDetails.getUsername(), id)));
    }
}
