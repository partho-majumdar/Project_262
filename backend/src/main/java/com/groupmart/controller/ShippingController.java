package com.groupmart.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.shipping.ShippingOptionDto;
import com.groupmart.service.ShippingService;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/shipping")
@RequiredArgsConstructor
public class ShippingController {

    private final ShippingService shippingService;

    @GetMapping("/methods")
    public ResponseEntity<ApiResponse<List<ShippingOptionDto>>> getShippingMethods(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) UUID addressId,
            @RequestParam(defaultValue = "0.00") BigDecimal subtotal
    ) {
        String userEmail = userDetails != null ? userDetails.getUsername() : null;
        List<ShippingOptionDto> options = shippingService.getAvailableShippingMethods(userEmail, addressId, subtotal);
        return ResponseEntity.ok(ApiResponse.success("Available shipping options calculated", options));
    }
}
