package com.groupmart.dto.order;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.groupmart.entity.OrderStatus;
import com.groupmart.entity.OrderType;
import com.groupmart.entity.PaymentMethod;
import com.groupmart.entity.PaymentStatus;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderDto {

    private UUID id;
    private String orderNumber;
    private String userEmail;
    private String userName;
    private List<OrderItemDto> items;
    private OrderStatus status;
    private PaymentStatus paymentStatus;
    private PaymentMethod paymentMethod;
    private BigDecimal subtotalAmount;
    private BigDecimal taxAmount;
    private BigDecimal shippingAmount;
    private BigDecimal discountAmount;
    private BigDecimal totalAmount;
    private String shippingAddressLine1;
    private String shippingAddressLine2;
    private String shippingCity;
    private String shippingState;
    private String shippingPostalCode;
    private String shippingCountry;
    private String couponCode;
    private OrderType orderType;
    private UUID groupBuyGroupId;
    /** Only filled for single-order and customer order list responses. */
    private OrderPaymentDetailsDto paymentDetails;
    private String shippingOptionId;
    private String shippingOptionLabel;
    private LocalDateTime estimatedDeliveryAt;
    /** AUTO (platform rule) or ADMIN (set by an administrator). */
    private String estimatedDeliverySource;
    private String estimatedDeliveryNote;
    private LocalDateTime shippedAt;
    private LocalDateTime deliveredAt;
    private LocalDateTime createdAt;
}
