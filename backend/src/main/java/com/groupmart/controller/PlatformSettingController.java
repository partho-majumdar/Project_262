package com.groupmart.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.entity.PlatformSetting;
import com.groupmart.service.PlatformSettingService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/settings")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class PlatformSettingController {

    private final PlatformSettingService platformSettingService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<PlatformSetting>>> getAllSettings() {
        List<PlatformSetting> settings = platformSettingService.getAllSettings();
        return ResponseEntity.ok(ApiResponse.success("Platform settings retrieved", settings));
    }

    @GetMapping("/map")
    public ResponseEntity<ApiResponse<Map<String, String>>> getSettingsAsMap() {
        Map<String, String> settings = platformSettingService.getSettingsAsMap();
        return ResponseEntity.ok(ApiResponse.success("Platform settings retrieved", settings));
    }

    /**
     * Bulk upsert backing the admin settings "Save" action. Keys with no existing
     * row are created, so the screen works on a database where seeding never ran.
     */
    @PutMapping
    public ResponseEntity<ApiResponse<Map<String, String>>> updateSettings(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> request
    ) {
        Map<String, String> updated = platformSettingService.upsertSettings(request, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Platform settings updated", updated));
    }

    @GetMapping("/{key}")
    public ResponseEntity<ApiResponse<PlatformSetting>> getSettingByKey(@PathVariable String key) {
        PlatformSetting setting = platformSettingService.getSettingByKey(key);
        return ResponseEntity.ok(ApiResponse.success("Setting retrieved", setting));
    }

    @PutMapping("/{key}")
    public ResponseEntity<ApiResponse<PlatformSetting>> updateSetting(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String key,
            @RequestBody Map<String, String> request
    ) {
        String value = request.get("value");
        PlatformSetting updated = platformSettingService.updateSetting(key, value, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Setting updated", updated));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<PlatformSetting>> createSetting(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> request
    ) {
        String key = request.get("key");
        String value = request.get("value");
        String description = request.get("description");
        PlatformSetting created = platformSettingService.createSetting(key, value, description, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Setting created", created));
    }
}
