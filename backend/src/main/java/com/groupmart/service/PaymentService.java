package com.groupmart.service;

import java.util.List;
import java.util.UUID;

import com.groupmart.dto.payment.PaymentIntentRequest;
import com.groupmart.dto.payment.PaymentIntentResponse;
import com.groupmart.dto.payment.PaymentTransactionDto;
import com.groupmart.dto.payment.PaymentWebhookRequest;

public interface PaymentService {

    PaymentIntentResponse createPaymentIntent(String userEmail, PaymentIntentRequest request);

    PaymentTransactionDto processPaymentWebhook(PaymentWebhookRequest request);

    List<PaymentTransactionDto> getUserTransactions(String userEmail);

    PaymentTransactionDto refundTransaction(String adminEmail, String transactionId);
}
