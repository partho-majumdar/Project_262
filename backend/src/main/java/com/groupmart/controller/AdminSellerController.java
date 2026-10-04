package com.groupmart.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.seller.SellerApplicationDto;
import com.groupmart.dto.seller.SellerReviewDecisionRequest;
import com.groupmart.dto.seller.SellerStoreDto;
import com.groupmart.service.SellerService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/sellers")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminSellerController {

    private final SellerService sellerService;

    @PutMapping("/{storeId}/verify")
    public ResponseEntity<ApiResponse<SellerStoreDto>> verifyStore(
            @PathVariable UUID storeId,
            @RequestParam(defaultValue = "true") boolean verify
    ) {
        SellerStoreDto store = sellerService.verifySellerStore(storeId, verify);
        String msg = verify ? "Seller store verified successfully" : "Seller store verification revoked";
        return ResponseEntity.ok(ApiResponse.success(msg, store));
    }

    @GetMapping("/applications")
    public ResponseEntity<ApiResponse<List<SellerApplicationDto>>> listApplications() {
        List<SellerApplicationDto> applications = sellerService.getAllSellerApplications();
        return ResponseEntity.ok(ApiResponse.success("Seller applications retrieved", applications));
    }

    @PutMapping("/applications/{userId}/decision")
    public ResponseEntity<ApiResponse<SellerApplicationDto>> reviewApplication(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID userId,
            @Valid @RequestBody SellerReviewDecisionRequest request
    ) {
        SellerApplicationDto updated = sellerService.reviewSellerApplication(
                userId, request.getDecision(), request.getReason(), userDetails.getUsername()
        );
        String msg = request.getDecision().name().equals("APPROVED")
                ? "Seller application approved"
                : "Seller application rejected";
        return ResponseEntity.ok(ApiResponse.success(msg, updated));
    }
}

