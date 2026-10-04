package com.groupmart.controller;

import java.security.Principal;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.groupr.GroupReverseDemandDto;
import com.groupmart.entity.GroupReverseDemandStatus;
import com.groupmart.service.AdminGroupReverseService;

import lombok.RequiredArgsConstructor;

/** Administrative moderation of group reverse demands. */
@RestController
@RequestMapping("/api/v1/admin/group-reverse-demands")
@RequiredArgsConstructor
public class AdminGroupReverseController {

    private final AdminGroupReverseService adminService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<GroupReverseDemandDto>>> list(
            @RequestParam(required = false) GroupReverseDemandStatus status) {
        return ResponseEntity.ok(ApiResponse.success("Group demands fetched successfully",
                adminService.listDemands(status)));
    }

    @GetMapping("/{demandId}")
    public ResponseEntity<ApiResponse<GroupReverseDemandDto>> get(@PathVariable UUID demandId) {
        return ResponseEntity.ok(ApiResponse.success("Group demand fetched successfully",
                adminService.getDemand(demandId)));
    }

    /**
     * Cancels a problematic demand and returns every member's reserved quantity. Only possible
     * before a seller has been selected; afterwards the group is contractually committed.
     */
    @PostMapping("/{demandId}/cancel")
    public ResponseEntity<ApiResponse<GroupReverseDemandDto>> cancel(
            Principal principal, @PathVariable UUID demandId,
            @RequestBody(required = false) com.groupmart.dto.groupr.GroupReverseReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Group demand cancelled successfully",
                adminService.cancelAsAdmin(demandId, email(principal),
                        request == null ? null : request.getReason())));
    }

    private static String email(Principal principal) {
        return principal == null ? null : principal.getName();
    }
}
