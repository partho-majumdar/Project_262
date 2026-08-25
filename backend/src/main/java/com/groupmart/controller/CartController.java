package com.groupmart.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.cart.AddToCartRequest;
import com.groupmart.dto.cart.CartDto;
import com.groupmart.dto.cart.UpdateCartItemRequest;
import com.groupmart.service.CartService;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    @GetMapping
    public ResponseEntity<ApiResponse<CartDto>> getCart(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader(value = "X-Session-Id", required = false) String sessionId
    ) {
        String userEmail = userDetails != null ? userDetails.getUsername() : null;
        CartDto cart = cartService.getCart(userEmail, sessionId);
        return ResponseEntity.ok(ApiResponse.success("Cart retrieved successfully", cart));
    }

    @PostMapping("/items")
    public ResponseEntity<ApiResponse<CartDto>> addItemToCart(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader(value = "X-Session-Id", required = false) String sessionId,
            @Valid @RequestBody AddToCartRequest request
    ) {
        String userEmail = userDetails != null ? userDetails.getUsername() : null;
        CartDto cart = cartService.addItemToCart(userEmail, sessionId, request);
        return ResponseEntity.ok(ApiResponse.success("Item added to cart", cart));
    }

    @PutMapping("/items/{cartItemId}")
    public ResponseEntity<ApiResponse<CartDto>> updateItemQuantity(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader(value = "X-Session-Id", required = false) String sessionId,
            @PathVariable UUID cartItemId,
            @Valid @RequestBody UpdateCartItemRequest request
    ) {
        String userEmail = userDetails != null ? userDetails.getUsername() : null;
        CartDto cart = cartService.updateItemQuantity(userEmail, sessionId, cartItemId, request);
        return ResponseEntity.ok(ApiResponse.success("Cart item quantity updated", cart));
    }

    @DeleteMapping("/items/{cartItemId}")
    public ResponseEntity<ApiResponse<CartDto>> removeItem(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader(value = "X-Session-Id", required = false) String sessionId,
            @PathVariable UUID cartItemId
    ) {
        String userEmail = userDetails != null ? userDetails.getUsername() : null;
        CartDto cart = cartService.removeItemFromCart(userEmail, sessionId, cartItemId);
        return ResponseEntity.ok(ApiResponse.success("Item removed from cart", cart));
    }

    @DeleteMapping("/clear")
    public ResponseEntity<ApiResponse<CartDto>> clearCart(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader(value = "X-Session-Id", required = false) String sessionId
    ) {
        String userEmail = userDetails != null ? userDetails.getUsername() : null;
        CartDto cart = cartService.clearCart(userEmail, sessionId);
        return ResponseEntity.ok(ApiResponse.success("Cart cleared", cart));
    }

    @PostMapping("/merge")
    public ResponseEntity<ApiResponse<Void>> mergeCart(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader(value = "X-Session-Id") String sessionId
    ) {
        if (userDetails != null) {
            cartService.mergeGuestCartToUser(userDetails.getUsername(), sessionId);
        }
        return ResponseEntity.ok(ApiResponse.success("Guest cart merged successfully", null));
    }
}
