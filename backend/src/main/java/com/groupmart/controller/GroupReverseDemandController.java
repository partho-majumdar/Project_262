package com.groupmart.controller;

import java.security.Principal;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.groupr.*;
import com.groupmart.service.GroupReverseDemandService;
import com.groupmart.service.GroupReverseOfferService;
import com.groupmart.service.GroupReverseParticipationService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Customer-facing group reverse demands: discovering them, creating one, joining one, and the
 * creator's authority over the seller round.
 * <p>
 * Kept apart from {@link ReverseGroupBuyingController}, which serves the seller-initiated mechanism.
 * Routes live under {@code /api/v1/group-reverse-demands} and share no path, DTO or service with it.
 */
@RestController
@RequestMapping("/api/v1/group-reverse-demands")
@RequiredArgsConstructor
public class GroupReverseDemandController {

    private final GroupReverseDemandService demandService;
    private final GroupReverseParticipationService participationService;
    private final GroupReverseOfferService offerService;

    // ---- Discovery -------------------------------------------------------------------------------

    @GetMapping
    public ResponseEntity<ApiResponse<List<GroupReverseDemandDto>>> discover(Principal principal) {
        return ResponseEntity.ok(ApiResponse.success("Group demands fetched successfully",
                demandService.discoverDemands(email(principal))));
    }

    // ---- Leader ----------------------------------------------------------------------------------

    @PostMapping
    public ResponseEntity<ApiResponse<GroupReverseDemandDto>> create(
            Principal principal, @Valid @RequestBody CreateGroupReverseDemandRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(
                "Group demand created as a draft", demandService.createDemand(email(principal), request)));
    }

    /** Every demand the signed-in customer created, as group leader. */
    @GetMapping("/my-led")
    public ResponseEntity<ApiResponse<List<GroupReverseDemandDto>>> myLedDemands(Principal principal) {
        return ResponseEntity.ok(ApiResponse.success("Your group demands fetched successfully",
                demandService.getMyLedDemands(email(principal))));
    }

    @PutMapping("/{demandId}")
    public ResponseEntity<ApiResponse<GroupReverseDemandDto>> update(
            Principal principal, @PathVariable UUID demandId,
            @Valid @RequestBody UpdateGroupReverseDemandRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Group demand updated successfully",
                demandService.updateDemand(email(principal), demandId, request)));
    }

    @PostMapping("/{demandId}/publish")
    public ResponseEntity<ApiResponse<GroupReverseDemandDto>> publish(
            Principal principal, @PathVariable UUID demandId) {
        return ResponseEntity.ok(ApiResponse.success("Group demand published successfully",
                demandService.publishDemand(email(principal), demandId)));
    }

    @PostMapping("/{demandId}/cancel")
    public ResponseEntity<ApiResponse<GroupReverseDemandDto>> cancel(
            Principal principal, @PathVariable UUID demandId,
            @RequestBody(required = false) GroupReverseReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Group demand cancelled successfully",
                demandService.cancelDemand(email(principal), demandId,
                        request == null ? null : request.getReason())));
    }

    // ---- Members ---------------------------------------------------------------------------------

    @GetMapping("/{demandId}")
    public ResponseEntity<ApiResponse<GroupReverseDemandDto>> get(
            Principal principal, @PathVariable UUID demandId) {
        return ResponseEntity.ok(ApiResponse.success("Group demand fetched successfully",
                demandService.getDemand(email(principal), demandId)));
    }

    @PostMapping("/{demandId}/join")
    public ResponseEntity<ApiResponse<GroupReverseMemberDto>> join(
            Principal principal, @PathVariable UUID demandId,
            @Valid @RequestBody JoinGroupReverseDemandRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(
                "You have joined the group demand",
                participationService.joinDemand(email(principal), demandId, request)));
    }

    @DeleteMapping("/{demandId}/leave")
    public ResponseEntity<ApiResponse<GroupReverseMemberDto>> leave(
            Principal principal, @PathVariable UUID demandId,
            @RequestBody(required = false) GroupReverseReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.success("You have left the group demand",
                participationService.leaveDemand(email(principal), demandId,
                        request == null ? null : request.getReason())));
    }

    @GetMapping("/{demandId}/members")
    public ResponseEntity<ApiResponse<List<GroupReverseMemberDto>>> members(
            Principal principal, @PathVariable UUID demandId) {
        return ResponseEntity.ok(ApiResponse.success("Group members fetched successfully",
                demandService.getMembers(email(principal), demandId)));
    }

    @GetMapping("/{demandId}/my-membership")
    public ResponseEntity<ApiResponse<GroupReverseMemberDto>> myMembership(
            Principal principal, @PathVariable UUID demandId) {
        return ResponseEntity.ok(ApiResponse.success("Your membership fetched successfully",
                participationService.getMyMembership(email(principal), demandId)));
    }

    /** Every demand the signed-in customer joined under somebody else's leadership. */
    @GetMapping("/my-joined")
    public ResponseEntity<ApiResponse<List<GroupReverseDemandDto>>> myJoined(Principal principal) {
        return ResponseEntity.ok(ApiResponse.success("Your joined group demands fetched successfully",
                participationService.getMyJoinedDemands(email(principal))));
    }

    // ---- The leader's view of the seller round ---------------------------------------------------

    @GetMapping("/{demandId}/offers")
    public ResponseEntity<ApiResponse<List<GroupReverseOfferDto>>> offers(
            Principal principal, @PathVariable UUID demandId) {
        return ResponseEntity.ok(ApiResponse.success("Seller offers fetched successfully",
                offerService.getOffersForDemand(email(principal), demandId)));
    }

    @PostMapping("/{demandId}/offers/{offerId}/select")
    public ResponseEntity<ApiResponse<GroupReverseSelectionResultDto>> select(
            Principal principal, @PathVariable UUID demandId, @PathVariable UUID offerId) {
        return ResponseEntity.ok(ApiResponse.success("Seller offer selected successfully",
                offerService.selectOffer(email(principal), demandId, offerId)));
    }

    private static String email(Principal principal) {
        return principal == null ? null : principal.getName();
    }
}
