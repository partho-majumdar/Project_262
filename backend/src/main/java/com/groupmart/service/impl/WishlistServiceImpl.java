package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.cart.AddToCartRequest;
import com.groupmart.dto.cart.CartDto;
import com.groupmart.dto.wishlist.WishlistDto;
import com.groupmart.dto.wishlist.WishlistItemDto;
import com.groupmart.entity.Product;
import com.groupmart.entity.User;
import com.groupmart.entity.Wishlist;
import com.groupmart.entity.WishlistItem;
import com.groupmart.repository.ProductRepository;
import com.groupmart.repository.UserRepository;
import com.groupmart.repository.WishlistItemRepository;
import com.groupmart.repository.WishlistRepository;
import com.groupmart.service.CartService;
import com.groupmart.service.WishlistService;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WishlistServiceImpl implements WishlistService {

    private final WishlistRepository wishlistRepository;
    private final WishlistItemRepository wishlistItemRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final CartService cartService;

    @Override
    @Transactional
    public WishlistDto getUserWishlist(String userEmail) {
        Wishlist wishlist = getOrCreateWishlist(userEmail);
        return mapToWishlistDto(wishlist);
    }

    @Override
    @Transactional
    public WishlistDto addItemToWishlist(String userEmail, UUID productId) {
        Wishlist wishlist = getOrCreateWishlist(userEmail);

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", productId));

        if (wishlistItemRepository.existsByWishlistIdAndProductId(wishlist.getId(), productId)) {
            return mapToWishlistDto(wishlist);
        }

        WishlistItem item = WishlistItem.builder()
                .wishlist(wishlist)
                .product(product)
                .build();

        wishlist.getItems().add(item);
        wishlistItemRepository.save(item);

        Wishlist updated = wishlistRepository.save(wishlist);
        return mapToWishlistDto(updated);
    }

    @Override
    @Transactional
    public WishlistDto removeItemFromWishlist(String userEmail, UUID productId) {
        Wishlist wishlist = getOrCreateWishlist(userEmail);

        Optional<WishlistItem> itemOpt = wishlistItemRepository.findByWishlistIdAndProductId(wishlist.getId(), productId);
        if (itemOpt.isPresent()) {
            WishlistItem item = itemOpt.get();
            wishlist.getItems().removeIf(i -> i.getId().equals(item.getId()));
            wishlistItemRepository.delete(item);
        }

        Wishlist updated = wishlistRepository.save(wishlist);
        return mapToWishlistDto(updated);
    }

    @Override
    @Transactional
    public CartDto moveToCart(String userEmail, UUID productId, String sessionId) {
        AddToCartRequest request = AddToCartRequest.builder()
                .productId(productId)
                .quantity(1)
                .build();

        CartDto cartDto = cartService.addItemToCart(userEmail, sessionId, request);

        // Automatically remove from wishlist after successfully moving to cart
        removeItemFromWishlist(userEmail, productId);

        return cartDto;
    }

    @Override
    @Transactional
    public WishlistDto clearWishlist(String userEmail) {
        Wishlist wishlist = getOrCreateWishlist(userEmail);
        wishlist.getItems().clear();
        Wishlist updated = wishlistRepository.save(wishlist);
        return mapToWishlistDto(updated);
    }

    private Wishlist getOrCreateWishlist(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        return wishlistRepository.findByUserId(user.getId()).orElseGet(() -> {
            Wishlist newWishlist = Wishlist.builder()
                    .user(user)
                    .items(new ArrayList<>())
                    .build();
            return wishlistRepository.save(newWishlist);
        });
    }

    private WishlistDto mapToWishlistDto(Wishlist wishlist) {
        List<WishlistItemDto> itemDtos = wishlist.getItems().stream().map(item -> {
            String imgUrl = (item.getProduct().getImageUrls() != null && !item.getProduct().getImageUrls().isEmpty())
                    ? item.getProduct().getImageUrls().get(0) : null;

            return WishlistItemDto.builder()
                    .id(item.getId())
                    .productId(item.getProduct().getId())
                    .productName(item.getProduct().getName())
                    .productSlug(item.getProduct().getSlug())
                    .productSku(item.getProduct().getSku())
                    .categoryName(item.getProduct().getCategory().getName())
                    .imageUrl(imgUrl)
                    .price(item.getProduct().getPrice())
                    .compareAtPrice(item.getProduct().getCompareAtPrice())
                    .inStock(item.getProduct().getStockQuantity() > 0)
                    .createdAt(item.getCreatedAt())
                    .build();
        }).collect(Collectors.toList());

        return WishlistDto.builder()
                .id(wishlist.getId())
                .items(itemDtos)
                .totalItems(itemDtos.size())
                .build();
    }
}
