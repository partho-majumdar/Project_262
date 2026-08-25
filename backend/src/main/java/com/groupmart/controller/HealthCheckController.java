package com.groupmart.controller;

import lombok.Builder;
import lombok.Data;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.groupmart.common.response.ApiResponse;

import java.lang.management.ManagementFactory;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/v1/health")
public class HealthCheckController {

    private static final long START_TIME = System.currentTimeMillis();

    @GetMapping
    public ResponseEntity<ApiResponse<HealthStatus>> checkHealth() {
        long uptimeMs = System.currentTimeMillis() - START_TIME;
        
        HealthStatus status = HealthStatus.builder()
                .status("UP")
                .application("groupmart-backend")
                .version("1.0.0")
                .timestamp(LocalDateTime.now())
                .uptimeSeconds(uptimeMs / 1000)
                .databaseStatus("CONNECTED")
                .build();

        return ResponseEntity.ok(ApiResponse.success("System health status normal", status));
    }

    @Data
    @Builder
    public static class HealthStatus {
        private String status;
        private String application;
        private String version;
        private LocalDateTime timestamp;
        private long uptimeSeconds;
        private String databaseStatus;
    }
}
