package com.groupmart.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.order.OrderDto;
import com.groupmart.dto.order.PlaceOrderRequest;
import com.groupmart.service.OrderService;

import java.util.List;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class OrderController {

    private final OrderService orderService;

    @PostMapping("/checkout")
    public ResponseEntity<ApiResponse<OrderDto>> placeOrder(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader(value = "X-Session-Id", required = false) String sessionId,
            @Valid @RequestBody PlaceOrderRequest request
    ) {
        OrderDto order = orderService.placeOrder(userDetails.getUsername(), sessionId, request);
        return new ResponseEntity<>(ApiResponse.success("Order placed successfully!", order, HttpStatus.CREATED.value()), HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<OrderDto>>> getUserOrders(@AuthenticationPrincipal UserDetails userDetails) {
        List<OrderDto> orders = orderService.getUserOrders(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("User orders retrieved", orders));
    }

    @GetMapping("/{orderNumber}")
    public ResponseEntity<ApiResponse<OrderDto>> getOrderByNumber(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String orderNumber
    ) {
        OrderDto order = orderService.getOrderByNumber(userDetails.getUsername(), orderNumber);
        return ResponseEntity.ok(ApiResponse.success("Order details retrieved", order));
    }

    @PutMapping("/{orderNumber}/cancel")
    public ResponseEntity<ApiResponse<OrderDto>> cancelOrder(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String orderNumber
    ) {
        OrderDto order = orderService.cancelOrder(userDetails.getUsername(), orderNumber);
        return ResponseEntity.ok(ApiResponse.success("Order cancelled successfully", order));
    }
}
