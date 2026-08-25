package com.groupmart.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.groupmart.common.response.ApiResponse;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/system-status")
public class HealthController {

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> getHealthStatus() {
        Map<String, Object> healthInfo = new HashMap<>();
        healthInfo.put("status", "UP");
        healthInfo.put("service", "GroupMart AI Backend API");
        healthInfo.put("version", "1.0.0");
        healthInfo.put("environment", System.getenv("SPRING_PROFILES_ACTIVE") != null 
                ? System.getenv("SPRING_PROFILES_ACTIVE") : "dev");
        healthInfo.put("timestamp", System.currentTimeMillis());

        return ResponseEntity.ok(ApiResponse.success("GroupMart API service is healthy and operational", healthInfo));
    }
}
