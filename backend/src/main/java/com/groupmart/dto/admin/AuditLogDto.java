package com.groupmart.dto.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogDto {

    private UUID id;
    private UUID userId;
    private String userEmail;
    private String action;
    private String resource;
    private String details;
    private String ipAddress;
    private LocalDateTime createdAt;
}
