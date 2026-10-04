package com.groupmart.service;

import java.util.List;
import java.util.UUID;

import com.groupmart.dto.order.OrderDto;
import com.groupmart.dto.order.PlaceOrderRequest;
import com.groupmart.dto.order.UpdateOrderStatusRequest;
import com.groupmart.entity.OrderStatus;

public interface OrderService {

    OrderDto placeOrder(String userEmail, String sessionId, PlaceOrderRequest request);

    List<OrderDto> getUserOrders(String userEmail);

    OrderDto getOrderByNumber(String userEmail, String orderNumber);

    OrderDto cancelOrder(String userEmail, String orderNumber);

    List<OrderDto> getMerchantOrders(String sellerEmail);

    /**
     * Fetches specific orders for a seller who owns at least one item in them, preserving the order
     * they were asked for. Used to show the orders behind a wholesale lot. Orders the seller does
     * not own are skipped rather than returned, so a lot can never leak another store's orders.
     */
    List<OrderDto> getOrdersForSeller(String sellerEmail, List<String> orderNumbers);

    OrderDto updateOrderStatus(String userEmail, String orderNumber, UpdateOrderStatusRequest request);

    List<OrderDto> getAllOrdersForAdmin();

    /** Administrator refund on one order; a null amount refunds everything the customer still has paid. */
    OrderDto refundOrder(String adminEmail, String orderNumber, java.math.BigDecimal amount, String reason);
}
