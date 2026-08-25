package com.groupmart.service;

import java.util.UUID;

import com.groupmart.dto.cart.CartDto;
import com.groupmart.dto.wishlist.WishlistDto;

public interface WishlistService {

    WishlistDto getUserWishlist(String userEmail);

    WishlistDto addItemToWishlist(String userEmail, UUID productId);

    WishlistDto removeItemFromWishlist(String userEmail, UUID productId);

    CartDto moveToCart(String userEmail, UUID productId, String sessionId);

    WishlistDto clearWishlist(String userEmail);
}
