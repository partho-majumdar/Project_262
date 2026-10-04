package com.groupmart.service.impl;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.groupmart.entity.Order;
import com.groupmart.entity.OrderItem;
import com.groupmart.entity.OrderStatus;
import com.groupmart.entity.OrderType;
import com.groupmart.entity.PaymentMethod;
import com.groupmart.entity.PaymentStatus;
import com.groupmart.entity.PaymentTransaction;
import com.groupmart.entity.Product;
import com.groupmart.entity.SellerStore;
import com.groupmart.entity.User;
import com.groupmart.repository.OrderItemRepository;
import com.groupmart.repository.OrderRepository;
import com.groupmart.repository.PaymentTransactionRepository;
import com.groupmart.service.DeliveryEstimateService;

/**
 * Creates the individual customer order that a collective purchasing mechanism resolves into once
 * its condition is met.
 * <p>
 * This is deliberately generic infrastructure shared by Reverse Group Buying and Group Buying
 * Auctions: it only knows how to turn "one customer bought N units at P" into a normal, individually
 * paid, individually shipped {@link Order}. It holds no collective business rules of its own, and the
 * CWP order generation path is left completely untouched.
 */
@Component
@RequiredArgsConstructor
public class CollectiveOrderFactory {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final DeliveryEstimateService deliveryEstimateService;

    private static final SecureRandom RANDOM = new SecureRandom();

    /**
     * @param orderNumberTag short tag used in the order number, e.g. {@code RGB} for Reverse Group
     *                       Buying and {@code AUC} for a Group Buying Auction
     */
    public Order createIndividualOrder(String orderNumberTag, OrderType orderType,
                                       Product product, SellerStore sellerStore, User customer,
                                       int quantity, BigDecimal unitPrice,
                                       ShippingSnapshot shipping, PaymentMethod paymentMethod,
                                       String paymentReference, String gatewayNote) {
        BigDecimal total = unitPrice.multiply(BigDecimal.valueOf(quantity));

        Order order = Order.builder()
                .orderNumber(generateOrderNumber(orderNumberTag))
                .user(customer)
                .status(OrderStatus.PENDING)
                .paymentStatus(PaymentStatus.COMPLETED)
                .paymentMethod(paymentMethod)
                .subtotalAmount(total)
                .taxAmount(BigDecimal.ZERO)
                .shippingAmount(BigDecimal.ZERO)
                .discountAmount(BigDecimal.ZERO)
                .totalAmount(total)
                .shippingAddressLine1(shipping.line1())
                .shippingAddressLine2(shipping.line2())
                .shippingCity(shipping.city())
                .shippingState(shipping.state())
                .shippingPostalCode(shipping.postalCode())
                .shippingCountry(shipping.country())
                .orderType(orderType)
                .items(new ArrayList<>())
                .build();
        // Parent-mechanism traceability is set by the caller right after the order is saved.
        deliveryEstimateService.applyOnPlacement(order);
        Order saved = orderRepository.save(order);

        OrderItem item = OrderItem.builder()
                .order(saved)
                .product(product)
                .sellerStore(sellerStore)
                .productName(product.getName())
                .productSku(product.getSku())
                .quantity(quantity)
                .unitPrice(unitPrice)
                .subtotal(total)
                .build();
        saved.getItems().add(item);
        orderItemRepository.save(item);

        if (paymentReference != null) {
            paymentTransactionRepository.save(PaymentTransaction.builder()
                    .order(saved)
                    .transactionId(paymentReference)
                    .paymentMethod(paymentMethod)
                    .status(PaymentStatus.COMPLETED)
                    .amount(total)
                    .gatewayResponse(gatewayNote)
                    .build());
        }
        return saved;
    }

    private String generateOrderNumber(String tag) {
        String datePrefix = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        String orderNumber;
        do {
            orderNumber = "ORD-" + datePrefix + "-" + tag + String.format("%05d", RANDOM.nextInt(100_000));
        } while (orderRepository.existsByOrderNumber(orderNumber));
        return orderNumber;
    }

    /** Sandbox payment reference prefix, unique per participation/bid. */
    public static String paymentReference(String prefix) {
        return "txn_" + prefix.toLowerCase() + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
    }
}
