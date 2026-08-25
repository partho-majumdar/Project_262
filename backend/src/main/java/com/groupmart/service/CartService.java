package com.groupmart.service;

import java.util.UUID;

import com.groupmart.dto.cart.AddToCartRequest;
import com.groupmart.dto.cart.CartDto;
import com.groupmart.dto.cart.UpdateCartItemRequest;

public interface CartService {

    CartDto getCart(String userEmail, String sessionId);

    CartDto addItemToCart(String userEmail, String sessionId, AddToCartRequest request);

    CartDto updateItemQuantity(String userEmail, String sessionId, UUID cartItemId, UpdateCartItemRequest request);

    CartDto removeItemFromCart(String userEmail, String sessionId, UUID cartItemId);

    CartDto clearCart(String userEmail, String sessionId);

    void mergeGuestCartToUser(String userEmail, String sessionId);
}
