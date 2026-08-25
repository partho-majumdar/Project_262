package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.cart.AddToCartRequest;
import com.groupmart.dto.cart.CartDto;
import com.groupmart.dto.cart.CartItemDto;
import com.groupmart.dto.cart.UpdateCartItemRequest;
import com.groupmart.entity.Cart;
import com.groupmart.entity.CartItem;
import com.groupmart.entity.Product;
import com.groupmart.entity.User;
import com.groupmart.repository.CartItemRepository;
import com.groupmart.repository.CartRepository;
import com.groupmart.repository.ProductRepository;
import com.groupmart.repository.UserRepository;
import com.groupmart.service.CartService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CartServiceImpl implements CartService {

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    private static final BigDecimal TAX_RATE = new BigDecimal("0.08"); // 8% estimated tax
    private static final BigDecimal FREE_SHIPPING_THRESHOLD = new BigDecimal("100.00");
    private static final BigDecimal DEFAULT_SHIPPING_FEE = new BigDecimal("15.00");

    @Override
    @Transactional
    public CartDto getCart(String userEmail, String sessionId) {
        Cart cart = getOrCreateCart(userEmail, sessionId);
        return mapToCartDto(cart);
    }

    @Override
    @Transactional
    public CartDto addItemToCart(String userEmail, String sessionId, AddToCartRequest request) {
        Cart cart = getOrCreateCart(userEmail, sessionId);

        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", request.getProductId()));

        if (!product.isActive()) {
            throw new ApiException("Product '" + product.getName() + "' is not currently available for purchase", HttpStatus.BAD_REQUEST);
        }

        Optional<CartItem> existingItemOpt = cartItemRepository.findByCartIdAndProductId(cart.getId(), product.getId());

        int targetQuantity = request.getQuantity();
        if (existingItemOpt.isPresent()) {
            targetQuantity += existingItemOpt.get().getQuantity();
        }

        if (product.getStockQuantity() < targetQuantity) {
            throw new ApiException("Insufficient inventory. Max available stock: " + product.getStockQuantity(), HttpStatus.BAD_REQUEST);
        }

        if (existingItemOpt.isPresent()) {
            CartItem existingItem = existingItemOpt.get();
            existingItem.setQuantity(targetQuantity);
            existingItem.setUnitPrice(product.getPrice());
            cartItemRepository.save(existingItem);
        } else {
            CartItem newItem = CartItem.builder()
                    .cart(cart)
                    .product(product)
                    .quantity(request.getQuantity())
                    .unitPrice(product.getPrice())
                    .build();
            cart.getItems().add(newItem);
            cartItemRepository.save(newItem);
        }

        Cart updatedCart = cartRepository.save(cart);
        return mapToCartDto(updatedCart);
    }

    @Override
    @Transactional
    public CartDto updateItemQuantity(String userEmail, String sessionId, UUID cartItemId, UpdateCartItemRequest request) {
        Cart cart = getOrCreateCart(userEmail, sessionId);

        CartItem cartItem = cartItemRepository.findById(cartItemId)
                .orElseThrow(() -> new ResourceNotFoundException("CartItem", "id", cartItemId));

        if (!cartItem.getCart().getId().equals(cart.getId())) {
            throw new ApiException("Cart item does not belong to user cart", HttpStatus.FORBIDDEN);
        }

        if (cartItem.getProduct().getStockQuantity() < request.getQuantity()) {
            throw new ApiException("Insufficient inventory. Max available stock: " + cartItem.getProduct().getStockQuantity(), HttpStatus.BAD_REQUEST);
        }

        cartItem.setQuantity(request.getQuantity());
        cartItemRepository.save(cartItem);

        Cart updatedCart = cartRepository.findById(cart.getId()).orElse(cart);
        return mapToCartDto(updatedCart);
    }

    @Override
    @Transactional
    public CartDto removeItemFromCart(String userEmail, String sessionId, UUID cartItemId) {
        Cart cart = getOrCreateCart(userEmail, sessionId);

        CartItem cartItem = cartItemRepository.findById(cartItemId)
                .orElseThrow(() -> new ResourceNotFoundException("CartItem", "id", cartItemId));

        if (!cartItem.getCart().getId().equals(cart.getId())) {
            throw new ApiException("Cart item does not belong to user cart", HttpStatus.FORBIDDEN);
        }

        cart.getItems().removeIf(item -> item.getId().equals(cartItemId));
        cartItemRepository.delete(cartItem);

        Cart updatedCart = cartRepository.save(cart);
        return mapToCartDto(updatedCart);
    }

    @Override
    @Transactional
    public CartDto clearCart(String userEmail, String sessionId) {
        Cart cart = getOrCreateCart(userEmail, sessionId);
        cart.getItems().clear();
        Cart updatedCart = cartRepository.save(cart);
        return mapToCartDto(updatedCart);
    }

    @Override
    @Transactional
    public void mergeGuestCartToUser(String userEmail, String sessionId) {
        if (sessionId == null || sessionId.trim().isEmpty()) return;

        User user = userRepository.findByEmail(userEmail).orElse(null);
        if (user == null) return;

        Optional<Cart> guestCartOpt = cartRepository.findBySessionId(sessionId);
        if (guestCartOpt.isEmpty() || guestCartOpt.get().getItems().isEmpty()) return;

        Cart guestCart = guestCartOpt.get();
        Cart userCart = cartRepository.findByUserId(user.getId()).orElseGet(() -> {
            Cart newCart = Cart.builder().user(user).items(new ArrayList<>()).build();
            return cartRepository.save(newCart);
        });

        for (CartItem guestItem : guestCart.getItems()) {
            Optional<CartItem> userItemOpt = cartItemRepository.findByCartIdAndProductId(userCart.getId(), guestItem.getProduct().getId());
            if (userItemOpt.isPresent()) {
                CartItem userItem = userItemOpt.get();
                int combinedQty = userItem.getQuantity() + guestItem.getQuantity();
                int availableStock = guestItem.getProduct().getStockQuantity();
                userItem.setQuantity(Math.min(combinedQty, availableStock));
                cartItemRepository.save(userItem);
            } else {
                CartItem newItem = CartItem.builder()
                        .cart(userCart)
                        .product(guestItem.getProduct())
                        .quantity(guestItem.getQuantity())
                        .unitPrice(guestItem.getUnitPrice())
                        .build();
                userCart.getItems().add(newItem);
                cartItemRepository.save(newItem);
            }
        }

        cartRepository.save(userCart);
        cartRepository.delete(guestCart);
    }

    private Cart getOrCreateCart(String userEmail, String sessionId) {
        if (userEmail != null && !userEmail.trim().isEmpty()) {
            User user = userRepository.findByEmail(userEmail)
                    .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

            return cartRepository.findByUserId(user.getId()).orElseGet(() -> {
                Cart newCart = Cart.builder().user(user).items(new ArrayList<>()).build();
                return cartRepository.save(newCart);
            });
        } else if (sessionId != null && !sessionId.trim().isEmpty()) {
            return cartRepository.findBySessionId(sessionId).orElseGet(() -> {
                Cart newCart = Cart.builder().sessionId(sessionId).items(new ArrayList<>()).build();
                return cartRepository.save(newCart);
            });
        } else {
            throw new ApiException("User session or guest session ID is required", HttpStatus.BAD_REQUEST);
        }
    }

    private CartDto mapToCartDto(Cart cart) {
        List<CartItemDto> itemDtos = cart.getItems().stream().map(item -> {
            BigDecimal subtotal = item.getUnitPrice().multiply(new BigDecimal(item.getQuantity()));
            String imgUrl = (item.getProduct().getImageUrls() != null && !item.getProduct().getImageUrls().isEmpty())
                    ? item.getProduct().getImageUrls().get(0) : null;

            return CartItemDto.builder()
                    .id(item.getId())
                    .productId(item.getProduct().getId())
                    .productName(item.getProduct().getName())
                    .productSlug(item.getProduct().getSlug())
                    .productSku(item.getProduct().getSku())
                    .imageUrl(imgUrl)
                    .unitPrice(item.getUnitPrice())
                    .quantity(item.getQuantity())
                    .subtotal(subtotal)
                    .stockAvailable(item.getProduct().getStockQuantity())
                    .build();
        }).collect(Collectors.toList());

        int totalItems = itemDtos.stream().mapToInt(CartItemDto::getQuantity).sum();
        BigDecimal subtotalAmount = itemDtos.stream()
                .map(CartItemDto::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal estimatedTax = subtotalAmount.multiply(TAX_RATE).setScale(2, RoundingMode.HALF_UP);
        BigDecimal shippingAmount = (subtotalAmount.compareTo(FREE_SHIPPING_THRESHOLD) >= 0 || totalItems == 0)
                ? BigDecimal.ZERO : DEFAULT_SHIPPING_FEE;

        BigDecimal totalAmount = subtotalAmount.add(estimatedTax).add(shippingAmount);

        return CartDto.builder()
                .id(cart.getId())
                .items(itemDtos)
                .totalItems(totalItems)
                .subtotalAmount(subtotalAmount)
                .estimatedTax(estimatedTax)
                .shippingAmount(shippingAmount)
                .totalAmount(totalAmount)
                .build();
    }
}
