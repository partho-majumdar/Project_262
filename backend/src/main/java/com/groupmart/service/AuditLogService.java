package com.groupmart.service;

import org.springframework.data.domain.Page;

import com.groupmart.dto.audit.AuditLogDto;
import com.groupmart.dto.audit.AuditLogSearchRequest;

import java.util.UUID;

public interface AuditLogService {

    void logActivity(String userEmail, String action, String resource, String details, String ipAddress);

    Page<AuditLogDto> getAuditLogs(int page, int size);

    Page<AuditLogDto> searchAuditLogs(AuditLogSearchRequest request);
}
