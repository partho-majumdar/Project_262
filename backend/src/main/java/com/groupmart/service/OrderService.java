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

    OrderDto updateOrderStatus(String userEmail, String orderNumber, UpdateOrderStatusRequest request);

    List<OrderDto> getAllOrdersForAdmin();
}
