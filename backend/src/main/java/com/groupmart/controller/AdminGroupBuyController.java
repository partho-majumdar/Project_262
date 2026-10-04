package com.groupmart.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.groupbuy.GroupBuyCampaignDto;
import com.groupmart.dto.groupbuy.GroupBuyDisputeDto;
import com.groupmart.dto.groupbuy.GroupBuyGroupDto;
import com.groupmart.dto.groupbuy.GroupBuyReasonRequest;
import com.groupmart.dto.groupbuy.admin.*;
import com.groupmart.dto.groupbuy.analytics.GroupBuyAnalyticsDto;
import com.groupmart.dto.order.DeliveryEstimateRequest;
import com.groupmart.dto.order.DeliveryEstimateSettingsDto;
import com.groupmart.dto.order.OrderDto;
import com.groupmart.entity.Order;
import com.groupmart.service.GroupBuyAdminService;
import com.groupmart.service.GroupBuyAnalyticsService;
import com.groupmart.service.GroupBuyCampaignService;
import com.groupmart.service.DeliveryEstimateService;
import com.groupmart.service.GroupBuyDisputeService;
import com.groupmart.service.OrderService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/group-buys")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminGroupBuyController {

    private final GroupBuyCampaignService campaignService;
    private final GroupBuyAdminService adminService;
    private final GroupBuyDisputeService disputeService;
    private final GroupBuyAnalyticsService analyticsService;
    private final DeliveryEstimateService deliveryEstimateService;
    private final OrderService orderService;

    // ----- Campaigns -------------------------------------------------------------------------

    @GetMapping
    public ResponseEntity<ApiResponse<List<GroupBuyCampaignDto>>> getCampaigns(
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success("Group buy campaigns retrieved",
                campaignService.getAllCampaigns(status)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<GroupBuyCampaignDto>> getCampaign(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Group buy campaign retrieved",
                campaignService.getCampaignForAdmin(id)));
    }

    @GetMapping("/{id}/groups")
    public ResponseEntity<ApiResponse<List<GroupBuyGroupDto>>> getGroups(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Campaign groups retrieved",
                campaignService.getCampaignGroupsForAdmin(id)));
    }

    @PostMapping("/{id}/force-close")
    public ResponseEntity<ApiResponse<GroupBuyCampaignDto>> forceClose(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) GroupBuyReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Group buy closed",
                campaignService.forceCloseCampaign(userDetails.getUsername(), id, reason(request))));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<GroupBuyCampaignDto>> cancel(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) GroupBuyReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Group buy cancelled",
                campaignService.adminCancelCampaign(userDetails.getUsername(), id, reason(request))));
    }

    // ----- Monitoring ------------------------------------------------------------------------

    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<AdminGroupBuyOverviewDto>> getOverview() {
        return ResponseEntity.ok(ApiResponse.success("Group buy overview retrieved", adminService.getOverview()));
    }

    @GetMapping("/participants")
    public ResponseEntity<ApiResponse<List<AdminGroupBuyParticipantDto>>> getParticipants(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "200") int limit) {
        return ResponseEntity.ok(ApiResponse.success("Group buy participants retrieved",
                adminService.getParticipants(status, q, limit)));
    }

    @GetMapping("/orders")
    public ResponseEntity<ApiResponse<List<AdminGroupBuyParticipantDto>>> getOrders(
            @RequestParam(defaultValue = "200") int limit) {
        return ResponseEntity.ok(ApiResponse.success("Group buy orders retrieved", adminService.getOrders(limit)));
    }

    @GetMapping("/activity")
    public ResponseEntity<ApiResponse<List<AdminGroupBuyActivityDto>>> getActivity(
            @RequestParam(defaultValue = "100") int limit) {
        return ResponseEntity.ok(ApiResponse.success("Group buy activity retrieved", adminService.getActivity(limit)));
    }

    @GetMapping("/inventory-logs")
    public ResponseEntity<ApiResponse<List<GroupBuyInventoryLogDto>>> getInventoryLogs() {
        return ResponseEntity.ok(ApiResponse.success("Group buy inventory logs retrieved",
                adminService.getInventoryLogs()));
    }

    @GetMapping("/groups/{groupId}")
    public ResponseEntity<ApiResponse<AdminGroupBuyGroupDetailDto>> getGroupDetail(@PathVariable UUID groupId) {
        return ResponseEntity.ok(ApiResponse.success("Group retrieved", adminService.getGroup(groupId)));
    }

    // ----- Group moderation ------------------------------------------------------------------

    @PostMapping("/groups/{groupId}/cancel")
    public ResponseEntity<ApiResponse<AdminGroupBuyGroupDetailDto>> cancelGroup(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID groupId,
            @Valid @RequestBody(required = false) GroupBuyReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Group cancelled and members refunded",
                adminService.cancelGroup(userDetails.getUsername(), groupId, reason(request))));
    }

    @PostMapping("/groups/{groupId}/members/{userId}/remove")
    public ResponseEntity<ApiResponse<AdminGroupBuyGroupDetailDto>> removeMember(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID groupId,
            @PathVariable UUID userId,
            @Valid @RequestBody(required = false) GroupBuyReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Member removed and refunded",
                adminService.removeMember(userDetails.getUsername(), groupId, userId, reason(request))));
    }

    // ----- Fraud flags -----------------------------------------------------------------------

    @GetMapping("/fraud-flags")
    public ResponseEntity<ApiResponse<List<GroupBuyFraudFlagDto>>> getFraudFlags(
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "false") boolean includeReviewed) {
        return ResponseEntity.ok(ApiResponse.success("Fraud flags retrieved",
                adminService.getFraudFlags(days, includeReviewed)));
    }

    @PostMapping("/fraud-flags/review")
    public ResponseEntity<ApiResponse<GroupBuyFraudFlagDto>> reviewFlag(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "30") int days,
            @Valid @RequestBody GroupBuyFlagReviewRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Flag reviewed",
                adminService.reviewFlag(userDetails.getUsername(), request, days)));
    }

    // ----- Disputes --------------------------------------------------------------------------

    @GetMapping("/disputes")
    public ResponseEntity<ApiResponse<List<GroupBuyDisputeDto>>> getDisputes(
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success("Disputes retrieved", disputeService.getDisputes(status)));
    }

    @GetMapping("/disputes/{disputeId}")
    public ResponseEntity<ApiResponse<GroupBuyDisputeDto>> getDispute(@PathVariable UUID disputeId) {
        return ResponseEntity.ok(ApiResponse.success("Dispute retrieved", disputeService.getDispute(disputeId)));
    }

    @PostMapping("/disputes/{disputeId}/review")
    public ResponseEntity<ApiResponse<GroupBuyDisputeDto>> reviewDispute(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID disputeId,
            @Valid @RequestBody(required = false) GroupBuyDisputeDecisionRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Dispute moved to review",
                disputeService.startReview(userDetails.getUsername(), disputeId,
                        request != null ? request.getNote() : null)));
    }

    @PostMapping("/disputes/{disputeId}/resolve")
    public ResponseEntity<ApiResponse<GroupBuyDisputeDto>> resolveDispute(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID disputeId,
            @Valid @RequestBody GroupBuyDisputeDecisionRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Dispute resolved",
                disputeService.resolve(userDetails.getUsername(), disputeId,
                        request.getRefundAmount(), request.getNote())));
    }

    @PostMapping("/disputes/{disputeId}/reject")
    public ResponseEntity<ApiResponse<GroupBuyDisputeDto>> rejectDispute(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID disputeId,
            @Valid @RequestBody GroupBuyDisputeDecisionRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Dispute rejected",
                disputeService.reject(userDetails.getUsername(), disputeId, request.getNote())));
    }

    // ----- Delivery estimates ----------------------------------------------------------------

    @GetMapping("/delivery-settings")
    public ResponseEntity<ApiResponse<DeliveryEstimateSettingsDto>> getDeliverySettings() {
        return ResponseEntity.ok(ApiResponse.success("Delivery estimate rule retrieved",
                deliveryEstimateService.getSettings()));
    }

    @PutMapping("/delivery-settings")
    public ResponseEntity<ApiResponse<DeliveryEstimateSettingsDto>> updateDeliverySettings(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody DeliveryEstimateSettingsDto request) {
        return ResponseEntity.ok(ApiResponse.success("Delivery estimate rule saved",
                deliveryEstimateService.updateSettings(userDetails.getUsername(), request)));
    }

    @GetMapping("/delivery-orders")
    public ResponseEntity<ApiResponse<List<OrderDto>>> getDeliveryOrders(
            @RequestParam(required = false) String scope,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "200") int limit) {
        return ResponseEntity.ok(ApiResponse.success("Delivery board retrieved",
                adminService.getDeliveryBoard(scope, status, q, limit)));
    }

    @PutMapping("/orders/{orderNumber}/estimated-delivery")
    public ResponseEntity<ApiResponse<OrderDto>> updateEstimatedDelivery(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String orderNumber,
            @Valid @RequestBody DeliveryEstimateRequest request) {
        Order saved = deliveryEstimateService.setAdminEstimate(userDetails.getUsername(), orderNumber,
                request.getEstimatedDeliveryAt(), request.getNote(), request.isResetToAutomatic());
        return ResponseEntity.ok(ApiResponse.success(
                request.isResetToAutomatic() ? "Delivery date back on the automatic rule" : "Delivery date updated",
                orderService.getOrderByNumber(userDetails.getUsername(), saved.getOrderNumber())));
    }

    // ----- Reports ---------------------------------------------------------------------------

    @GetMapping("/reports")
    public ResponseEntity<ApiResponse<GroupBuyAnalyticsDto>> getReport(@RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(ApiResponse.success("Group buy report generated",
                analyticsService.getPlatformAnalytics(days)));
    }

    private static String reason(GroupBuyReasonRequest request) {
        return request != null ? request.getReason() : null;
    }
}
