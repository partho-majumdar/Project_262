package com.groupmart.controller;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.wallet.PayoutRequestDto;
import com.groupmart.dto.wallet.SellerWalletDto;
import com.groupmart.service.WalletService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/seller/wallet")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SELLER', 'ADMIN')")
public class SellerWalletController {

    private final WalletService walletService;

    @GetMapping
    public ResponseEntity<ApiResponse<SellerWalletDto>> getWallet(
            @AuthenticationPrincipal UserDetails userDetails) {
        SellerWalletDto wallet = walletService.getWallet(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Wallet retrieved", wallet));
    }

    @PostMapping("/payout")
    public ResponseEntity<ApiResponse<SellerWalletDto>> requestPayout(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody PayoutRequestDto request) {
        SellerWalletDto wallet = walletService.requestPayout(userDetails.getUsername(), request);
        return ResponseEntity.ok(ApiResponse.success("Payout requested", wallet));
    }
}
