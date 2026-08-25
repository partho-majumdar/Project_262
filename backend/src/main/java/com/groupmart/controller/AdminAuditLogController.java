package com.groupmart.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.audit.AuditLogDto;
import com.groupmart.dto.audit.AuditLogSearchRequest;
import com.groupmart.service.AuditLogService;

@RestController
@RequestMapping("/api/v1/admin/audit-logs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminAuditLogController {

    private final AuditLogService auditLogService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<AuditLogDto>>> getAuditLogs(
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "50") int size
    ) {
        Page<AuditLogDto> logs = auditLogService.getAuditLogs(page, size);
        return ResponseEntity.ok(ApiResponse.success("Audit logs retrieved", logs));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<Page<AuditLogDto>>> searchAuditLogs(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String userEmail,
            @RequestParam(required = false) String action,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "50") int size
    ) {
        AuditLogSearchRequest request = AuditLogSearchRequest.builder()
                .query(q)
                .userEmail(userEmail)
                .action(action)
                .page(page)
                .size(size)
                .build();

        Page<AuditLogDto> logs = auditLogService.searchAuditLogs(request);
        return ResponseEntity.ok(ApiResponse.success("Filtered audit logs retrieved", logs));
    }
}
