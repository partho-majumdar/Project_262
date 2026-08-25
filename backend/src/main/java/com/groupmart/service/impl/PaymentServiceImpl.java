package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.payment.PaymentIntentRequest;
import com.groupmart.dto.payment.PaymentIntentResponse;
import com.groupmart.dto.payment.PaymentTransactionDto;
import com.groupmart.dto.payment.PaymentWebhookRequest;
import com.groupmart.entity.Order;
import com.groupmart.entity.PaymentStatus;
import com.groupmart.entity.PaymentTransaction;
import com.groupmart.entity.User;
import com.groupmart.repository.OrderRepository;
import com.groupmart.repository.PaymentTransactionRepository;
import com.groupmart.repository.UserRepository;
import com.groupmart.service.PaymentService;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PaymentServiceImpl implements PaymentService {

    private final PaymentTransactionRepository paymentTransactionRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public PaymentIntentResponse createPaymentIntent(String userEmail, PaymentIntentRequest request) {
        String txnPrefix = request.getPaymentMethod().name().toLowerCase();
        String randomStr = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String transactionId = "txn_" + txnPrefix + "_" + randomStr;
        String clientSecret = "secret_" + randomStr + "_secret_key";

        Order order = null;
        if (request.getOrderId() != null) {
            order = orderRepository.findById(request.getOrderId()).orElse(null);
        }

        if (order != null) {
            PaymentTransaction transaction = PaymentTransaction.builder()
                    .order(order)
                    .transactionId(transactionId)
                    .paymentMethod(request.getPaymentMethod())
                    .status(PaymentStatus.PENDING)
                    .amount(request.getAmount())
                    .gatewayResponse("SIMULATED_INTENT_CREATED")
                    .build();
            paymentTransactionRepository.save(transaction);
        }

        return PaymentIntentResponse.builder()
                .clientSecret(clientSecret)
                .transactionId(transactionId)
                .status(PaymentStatus.PENDING)
                .amount(request.getAmount())
                .publishableKey("pk_test_nexus_commerce_ai_live_pubkey")
                .build();
    }

    @Override
    @Transactional
    public PaymentTransactionDto processPaymentWebhook(PaymentWebhookRequest request) {
        PaymentTransaction transaction = paymentTransactionRepository.findByTransactionId(request.getTransactionId())
                .orElseThrow(() -> new ResourceNotFoundException("PaymentTransaction", "transactionId", request.getTransactionId()));

        transaction.setStatus(request.getStatus());
        transaction.setGatewayResponse(request.getPayload() != null ? request.getPayload() : "WEBHOOK_EVENT_PROCESSED");

        // Atomically sync PaymentStatus with Order
        Order order = transaction.getOrder();
        if (order != null) {
            order.setPaymentStatus(request.getStatus());
            orderRepository.save(order);
        }

        PaymentTransaction updated = paymentTransactionRepository.save(transaction);
        return mapToDto(updated);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PaymentTransactionDto> getUserTransactions(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        List<Order> userOrders = orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        List<UUID> orderIds = userOrders.stream().map(Order::getId).collect(Collectors.toList());

        return paymentTransactionRepository.findAll().stream()
                .filter(t -> t.getOrder() != null && orderIds.contains(t.getOrder().getId()))
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public PaymentTransactionDto refundTransaction(String adminEmail, String transactionId) {
        PaymentTransaction transaction = paymentTransactionRepository.findByTransactionId(transactionId)
                .orElseThrow(() -> new ResourceNotFoundException("PaymentTransaction", "transactionId", transactionId));

        if (transaction.getStatus() == PaymentStatus.REFUNDED) {
            throw new ApiException("Transaction has already been refunded", HttpStatus.BAD_REQUEST);
        }

        transaction.setStatus(PaymentStatus.REFUNDED);
        transaction.setGatewayResponse("GATEWAY_REFUND_EXECUTED");

        if (transaction.getOrder() != null) {
            transaction.getOrder().setPaymentStatus(PaymentStatus.REFUNDED);
            orderRepository.save(transaction.getOrder());
        }

        PaymentTransaction updated = paymentTransactionRepository.save(transaction);
        return mapToDto(updated);
    }

    private PaymentTransactionDto mapToDto(PaymentTransaction transaction) {
        return PaymentTransactionDto.builder()
                .id(transaction.getId())
                .orderNumber(transaction.getOrder() != null ? transaction.getOrder().getOrderNumber() : null)
                .transactionId(transaction.getTransactionId())
                .paymentMethod(transaction.getPaymentMethod())
                .status(transaction.getStatus())
                .amount(transaction.getAmount())
                .gatewayResponse(transaction.getGatewayResponse())
                .createdAt(transaction.getCreatedAt())
                .build();
    }
}
