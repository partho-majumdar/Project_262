package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.coupon.ApplyCouponRequest;
import com.groupmart.dto.coupon.CouponValidationResponse;
import com.groupmart.dto.order.OrderDto;
import com.groupmart.dto.order.OrderItemDto;
import com.groupmart.dto.order.PlaceOrderRequest;
import com.groupmart.dto.order.UpdateOrderStatusRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.CartService;
import com.groupmart.service.CouponService;
import com.groupmart.service.InventoryService;
import com.groupmart.service.OrderService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final CartRepository cartRepository;
    private final UserRepository userRepository;
    private final AddressRepository addressRepository;
    private final SellerStoreRepository sellerStoreRepository;
    private final CartService cartService;
    private final InventoryService inventoryService;
    private final CouponService couponService;

    private static final BigDecimal TAX_RATE = new BigDecimal("0.08");

    @Override
    @Transactional
    public OrderDto placeOrder(String userEmail, String sessionId, PlaceOrderRequest request) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        Cart cart = cartRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ApiException("Shopping cart is empty. Add products before checking out.", HttpStatus.BAD_REQUEST));

        if (cart.getItems().isEmpty()) {
            throw new ApiException("Shopping cart is empty. Add products before checking out.", HttpStatus.BAD_REQUEST);
        }

        // Determine shipping address
        String addressLine1 = request.getShippingAddressLine1();
        String addressLine2 = request.getShippingAddressLine2();
        String city = request.getShippingCity();
        String state = request.getShippingState();
        String postalCode = request.getShippingPostalCode();
        String country = request.getShippingCountry();

        if (request.getAddressId() != null) {
            Address address = addressRepository.findById(request.getAddressId())
                    .orElseThrow(() -> new ResourceNotFoundException("Address", "id", request.getAddressId()));
            addressLine1 = address.getStreetAddress();
            addressLine2 = address.getApartment();
            city = address.getCity();
            state = address.getState();
            postalCode = address.getPostalCode();
            country = address.getCountry();
        }

        if (addressLine1 == null || city == null || state == null || postalCode == null || country == null) {
            throw new ApiException("Valid shipping address is required to place order", HttpStatus.BAD_REQUEST);
        }

        // Calculate Subtotal & Verify Stock
        BigDecimal subtotal = BigDecimal.ZERO;
        for (CartItem item : cart.getItems()) {
            BigDecimal lineSubtotal = item.getUnitPrice().multiply(new BigDecimal(item.getQuantity()));
            subtotal = subtotal.add(lineSubtotal);

            if (item.getProduct().getStockQuantity() < item.getQuantity()) {
                throw new ApiException("Insufficient inventory for '" + item.getProduct().getName() + "'. Available: " + item.getProduct().getStockQuantity(), HttpStatus.BAD_REQUEST);
            }
        }

        // Apply Promo Coupon if provided
        BigDecimal discountAmount = BigDecimal.ZERO;
        String couponCode = null;
        if (request.getCouponCode() != null && !request.getCouponCode().trim().isEmpty()) {
            CouponValidationResponse couponResponse = couponService.validateAndCalculateCoupon(
                    ApplyCouponRequest.builder().code(request.getCouponCode()).subtotal(subtotal).build()
            );

            if (couponResponse.isValid()) {
                discountAmount = couponResponse.getCalculatedDiscount();
                couponCode = couponResponse.getCode();
                couponService.incrementCouponUsage(couponCode);
            }
        }

        // Calculate Tax & Shipping
        BigDecimal discountedSubtotal = Math.max(0, subtotal.subtract(discountAmount).doubleValue()) > 0
                ? subtotal.subtract(discountAmount) : BigDecimal.ZERO;

        BigDecimal taxAmount = discountedSubtotal.multiply(TAX_RATE).setScale(2, RoundingMode.HALF_UP);

        BigDecimal shippingAmount = new BigDecimal("15.00");
        if ("PRIORITY_EXPRESS".equalsIgnoreCase(request.getShippingOptionId())) {
            shippingAmount = new BigDecimal("29.99");
        } else if ("OVERNIGHT_COURIER".equalsIgnoreCase(request.getShippingOptionId())) {
            shippingAmount = new BigDecimal("49.99");
        } else if (discountedSubtotal.compareTo(new BigDecimal("100.00")) >= 0) {
            shippingAmount = BigDecimal.ZERO; // Free Standard Shipping
        }

        BigDecimal totalAmount = discountedSubtotal.add(taxAmount).add(shippingAmount);

        // Generate Order Number (e.g., ORD-20260726-8849)
        String orderNumber = generateOrderNumber();

        Order order = Order.builder()
                .orderNumber(orderNumber)
                .user(user)
                .status(OrderStatus.PROCESSING)
                .paymentStatus(request.getPaymentMethod() == PaymentMethod.CASH_ON_DELIVERY ? PaymentStatus.PENDING : PaymentStatus.COMPLETED)
                .paymentMethod(request.getPaymentMethod())
                .subtotalAmount(subtotal)
                .taxAmount(taxAmount)
                .shippingAmount(shippingAmount)
                .discountAmount(discountAmount)
                .totalAmount(totalAmount)
                .shippingAddressLine1(addressLine1)
                .shippingAddressLine2(addressLine2)
                .shippingCity(city)
                .shippingState(state)
                .shippingPostalCode(postalCode)
                .shippingCountry(country)
                .couponCode(couponCode)
                .items(new ArrayList<>())
                .build();

        Order savedOrder = orderRepository.save(order);

        // Process Order Items & Atomic Inventory Reserve
        for (CartItem cartItem : cart.getItems()) {
            BigDecimal lineSubtotal = cartItem.getUnitPrice().multiply(new BigDecimal(cartItem.getQuantity()));

            OrderItem orderItem = OrderItem.builder()
                    .order(savedOrder)
                    .product(cartItem.getProduct())
                    .sellerStore(cartItem.getProduct().getSellerStore())
                    .productName(cartItem.getProduct().getName())
                    .productSku(cartItem.getProduct().getSku())
                    .quantity(cartItem.getQuantity())
                    .unitPrice(cartItem.getUnitPrice())
                    .subtotal(lineSubtotal)
                    .build();

            savedOrder.getItems().add(orderItem);
            orderItemRepository.save(orderItem);

            // Reserve/Deduct Stock in Warehouse Inventory Engine
            inventoryService.reserveStockForOrder(cartItem.getProduct().getId(), cartItem.getQuantity(), orderNumber);
        }

        // Clear user cart
        cartService.clearCart(userEmail, sessionId);

        return mapToOrderDto(savedOrder);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderDto> getUserOrders(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        return orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(this::mapToOrderDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public OrderDto getOrderByNumber(String userEmail, String orderNumber) {
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Order", "orderNumber", orderNumber));

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        if (user.getRole() != Role.ROLE_ADMIN && !order.getUser().getId().equals(user.getId())) {
            throw new ApiException("You are not authorized to view this order", HttpStatus.FORBIDDEN);
        }

        return mapToOrderDto(order);
    }

    @Override
    @Transactional
    public OrderDto cancelOrder(String userEmail, String orderNumber) {
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Order", "orderNumber", orderNumber));

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        if (user.getRole() != Role.ROLE_ADMIN && !order.getUser().getId().equals(user.getId())) {
            throw new ApiException("You are not authorized to cancel this order", HttpStatus.FORBIDDEN);
        }

        if (order.getStatus() == OrderStatus.SHIPPED || order.getStatus() == OrderStatus.DELIVERED) {
            throw new ApiException("Order cannot be cancelled because it has already been shipped or delivered", HttpStatus.BAD_REQUEST);
        }

        order.setStatus(OrderStatus.CANCELLED);
        if (order.getPaymentStatus() == PaymentStatus.COMPLETED) {
            order.setPaymentStatus(PaymentStatus.REFUNDED);
        }

        // Revert inventory stock
        for (OrderItem item : order.getItems()) {
            inventoryService.releaseStockForCancelledOrder(item.getProduct().getId(), item.getQuantity(), orderNumber);
        }

        Order updated = orderRepository.save(order);
        return mapToOrderDto(updated);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderDto> getMerchantOrders(String sellerEmail) {
        User user = userRepository.findByEmail(sellerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", sellerEmail));

        SellerStore store = sellerStoreRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("SellerStore", "userId", user.getId()));

        List<OrderItem> merchantItems = orderItemRepository.findBySellerStoreIdOrderByCreatedAtDesc(store.getId());

        List<Order> merchantOrders = merchantItems.stream()
                .map(OrderItem::getOrder)
                .distinct()
                .collect(Collectors.toList());

        return merchantOrders.stream().map(this::mapToOrderDto).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public OrderDto updateOrderStatus(String userEmail, String orderNumber, UpdateOrderStatusRequest request) {
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Order", "orderNumber", orderNumber));

        order.setStatus(request.getStatus());
        if (request.getStatus() == OrderStatus.DELIVERED) {
            order.setPaymentStatus(PaymentStatus.COMPLETED);
        }

        Order updated = orderRepository.save(order);
        return mapToOrderDto(updated);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderDto> getAllOrdersForAdmin() {
        return orderRepository.findAll().stream()
                .map(this::mapToOrderDto)
                .collect(Collectors.toList());
    }

    private String generateOrderNumber() {
        String datePrefix = LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd"));
        String randomDigits = String.format("%04d", (int) (Math.random() * 10000));
        String orderNumber = "ORD-" + datePrefix + "-" + randomDigits;

        while (orderRepository.existsByOrderNumber(orderNumber)) {
            randomDigits = String.format("%04d", (int) (Math.random() * 10000));
            orderNumber = "ORD-" + datePrefix + "-" + randomDigits;
        }
        return orderNumber;
    }

    private OrderDto mapToOrderDto(Order order) {
        List<OrderItemDto> itemDtos = order.getItems().stream().map(item -> {
            String imgUrl = (item.getProduct().getImageUrls() != null && !item.getProduct().getImageUrls().isEmpty())
                    ? item.getProduct().getImageUrls().get(0) : null;

            return OrderItemDto.builder()
                    .id(item.getId())
                    .productId(item.getProduct().getId())
                    .productName(item.getProductName())
                    .productSlug(item.getProduct().getSlug())
                    .productSku(item.getProductSku())
                    .imageUrl(imgUrl)
                    .quantity(item.getQuantity())
                    .unitPrice(item.getUnitPrice())
                    .subtotal(item.getSubtotal())
                    .sellerStoreName(item.getSellerStore() != null ? item.getSellerStore().getStoreName() : "GroupMart Official Store")
                    .build();
        }).collect(Collectors.toList());

        return OrderDto.builder()
                .id(order.getId())
                .orderNumber(order.getOrderNumber())
                .userEmail(order.getUser().getEmail())
                .userName(order.getUser().getFirstName() + " " + order.getUser().getLastName())
                .items(itemDtos)
                .status(order.getStatus())
                .paymentStatus(order.getPaymentStatus())
                .paymentMethod(order.getPaymentMethod())
                .subtotalAmount(order.getSubtotalAmount())
                .taxAmount(order.getTaxAmount())
                .shippingAmount(order.getShippingAmount())
                .discountAmount(order.getDiscountAmount())
                .totalAmount(order.getTotalAmount())
                .shippingAddressLine1(order.getShippingAddressLine1())
                .shippingAddressLine2(order.getShippingAddressLine2())
                .shippingCity(order.getShippingCity())
                .shippingState(order.getShippingState())
                .shippingPostalCode(order.getShippingPostalCode())
                .shippingCountry(order.getShippingCountry())
                .couponCode(order.getCouponCode())
                .createdAt(order.getCreatedAt())
                .build();
    }
}
