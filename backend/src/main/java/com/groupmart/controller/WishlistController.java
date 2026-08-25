package com.groupmart.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.cart.CartDto;
import com.groupmart.dto.wishlist.WishlistDto;
import com.groupmart.service.WishlistService;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/wishlist")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class WishlistController {

    private final WishlistService wishlistService;

    @GetMapping
    public ResponseEntity<ApiResponse<WishlistDto>> getUserWishlist(@AuthenticationPrincipal UserDetails userDetails) {
        WishlistDto wishlist = wishlistService.getUserWishlist(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Wishlist retrieved successfully", wishlist));
    }

    @PostMapping("/items/{productId}")
    public ResponseEntity<ApiResponse<WishlistDto>> addItemToWishlist(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID productId
    ) {
        WishlistDto wishlist = wishlistService.addItemToWishlist(userDetails.getUsername(), productId);
        return ResponseEntity.ok(ApiResponse.success("Product added to wishlist", wishlist));
    }

    @DeleteMapping("/items/{productId}")
    public ResponseEntity<ApiResponse<WishlistDto>> removeItemFromWishlist(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID productId
    ) {
        WishlistDto wishlist = wishlistService.removeItemFromWishlist(userDetails.getUsername(), productId);
        return ResponseEntity.ok(ApiResponse.success("Product removed from wishlist", wishlist));
    }

    @PostMapping("/items/{productId}/move-to-cart")
    public ResponseEntity<ApiResponse<CartDto>> moveToCart(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestHeader(value = "X-Session-Id", required = false) String sessionId,
            @PathVariable UUID productId
    ) {
        CartDto cart = wishlistService.moveToCart(userDetails.getUsername(), productId, sessionId);
        return ResponseEntity.ok(ApiResponse.success("Item moved from wishlist to shopping cart", cart));
    }

    @DeleteMapping("/clear")
    public ResponseEntity<ApiResponse<WishlistDto>> clearWishlist(@AuthenticationPrincipal UserDetails userDetails) {
        WishlistDto wishlist = wishlistService.clearWishlist(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Wishlist cleared", wishlist));
    }
}
