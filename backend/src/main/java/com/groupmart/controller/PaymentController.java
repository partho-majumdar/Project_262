package com.groupmart.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.payment.PaymentIntentRequest;
import com.groupmart.dto.payment.PaymentIntentResponse;
import com.groupmart.dto.payment.PaymentTransactionDto;
import com.groupmart.dto.payment.PaymentWebhookRequest;
import com.groupmart.service.PaymentService;

import java.util.List;

@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping("/create-intent")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<PaymentIntentResponse>> createPaymentIntent(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody PaymentIntentRequest request
    ) {
        PaymentIntentResponse response = paymentService.createPaymentIntent(userDetails.getUsername(), request);
        return ResponseEntity.ok(ApiResponse.success("Payment intent created successfully", response));
    }

    @PostMapping("/webhook")
    public ResponseEntity<ApiResponse<PaymentTransactionDto>> handleWebhook(@Valid @RequestBody PaymentWebhookRequest request) {
        PaymentTransactionDto dto = paymentService.processPaymentWebhook(request);
        return ResponseEntity.ok(ApiResponse.success("Payment webhook processed", dto));
    }

    @GetMapping("/transactions")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<PaymentTransactionDto>>> getUserTransactions(@AuthenticationPrincipal UserDetails userDetails) {
        List<PaymentTransactionDto> transactions = paymentService.getUserTransactions(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Payment transactions retrieved", transactions));
    }

    @PostMapping("/transactions/{transactionId}/refund")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PaymentTransactionDto>> refundTransaction(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String transactionId
    ) {
        PaymentTransactionDto refunded = paymentService.refundTransaction(userDetails.getUsername(), transactionId);
        return ResponseEntity.ok(ApiResponse.success("Payment transaction refunded successfully", refunded));
    }
}
