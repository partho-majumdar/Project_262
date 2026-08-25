package com.groupmart.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.order.OrderDto;
import com.groupmart.dto.order.UpdateOrderStatusRequest;
import com.groupmart.service.OrderService;

import java.util.List;

@RestController
@RequestMapping("/api/v1/seller/orders")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SELLER', 'ADMIN')")
public class SellerOrderController {

    private final OrderService orderService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<OrderDto>>> getMerchantOrders(@AuthenticationPrincipal UserDetails userDetails) {
        List<OrderDto> orders = orderService.getMerchantOrders(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Merchant orders retrieved", orders));
    }

    @PutMapping("/{orderNumber}/status")
    public ResponseEntity<ApiResponse<OrderDto>> updateOrderStatus(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String orderNumber,
            @Valid @RequestBody UpdateOrderStatusRequest request
    ) {
        OrderDto updated = orderService.updateOrderStatus(userDetails.getUsername(), orderNumber, request);
        return ResponseEntity.ok(ApiResponse.success("Order status updated", updated));
    }
}
