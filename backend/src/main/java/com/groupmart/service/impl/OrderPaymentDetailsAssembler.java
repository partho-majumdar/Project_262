package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.groupmart.dto.order.OrderPaymentDetailsDto;
import com.groupmart.entity.*;
import com.groupmart.repository.GroupBuyParticipantRepository;
import com.groupmart.repository.PaymentTransactionRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

/**
 * Builds the payment and refund breakdown for an order from its payment transactions
 * and, for group buy orders, the member's join-time payment.
 */
@Component
@RequiredArgsConstructor
public class OrderPaymentDetailsAssembler {

    /** Transaction ids of refund rows end with this suffix; other rows are payments. */
    public static final String REFUND_SUFFIX = "_rf";

    private final PaymentTransactionRepository paymentTransactionRepository;
    private final GroupBuyParticipantRepository participantRepository;

    public OrderPaymentDetailsDto build(Order order) {
        List<PaymentTransaction> rows = paymentTransactionRepository.findByOrderIdOrderByCreatedAtDesc(order.getId());
        List<OrderPaymentDetailsDto.Entry> entries = rows.stream().map(this::toEntry).toList();

        BigDecimal paymentRows = BigDecimal.ZERO;
        BigDecimal refunded = BigDecimal.ZERO;
        for (PaymentTransaction row : rows) {
            boolean refundRow = isRefund(row);
            if (refundRow) {
                refunded = refunded.add(row.getAmount());
            } else if (row.getStatus() == PaymentStatus.COMPLETED || row.getStatus() == PaymentStatus.REFUNDED) {
                paymentRows = paymentRows.add(row.getAmount());
                if (row.getStatus() == PaymentStatus.REFUNDED) {
                    refunded = refunded.add(row.getAmount());
                }
            }
        }

        OrderPaymentDetailsDto.GroupBuy groupBuy = null;
        BigDecimal charged = paymentRows;
        if (order.getOrderType() == OrderType.GROUP_BUY) {
            GroupBuyParticipant member = participantRepository.findByOrderId(order.getId()).orElse(null);
            if (member != null) {
                groupBuy = OrderPaymentDetailsDto.GroupBuy.builder()
                        .unitPriceAtJoin(member.getUnitPriceAtJoin())
                        .amountPaidAtJoin(member.getAmountPaid())
                        .finalUnitPrice(member.getFinalUnitPrice())
                        .priceDropRefund(orZero(member.getRefundAmount()))
                        .quantity(member.getQuantity())
                        .paymentReference(member.getPaymentReference())
                        .paidAt(member.getJoinedAt())
                        .build();
                // The member paid the join-time price; the capture row only holds the final amount
                charged = member.getAmountPaid();
            }
        }

        boolean paid = order.getPaymentStatus() == PaymentStatus.COMPLETED
                || order.getPaymentStatus() == PaymentStatus.REFUNDED;
        if (charged.signum() == 0 && paid) {
            // Standard checkouts don't always record a transaction row
            charged = order.getTotalAmount();
        }
        if (order.getPaymentStatus() == PaymentStatus.REFUNDED && refunded.compareTo(charged) < 0) {
            refunded = charged;
        }
        refunded = refunded.min(charged);
        BigDecimal net = charged.subtract(refunded).max(BigDecimal.ZERO);

        return OrderPaymentDetailsDto.builder()
                .paymentMethod(order.getPaymentMethod())
                .paymentStatus(order.getPaymentStatus())
                .statusMessage(statusMessage(order, charged, refunded, net))
                .amountCharged(scale(charged))
                .refundedAmount(scale(refunded))
                .netPaid(scale(net))
                .transactions(entries)
                .groupBuy(groupBuy)
                .build();
    }

    /** Records a sandbox refund row so the refund shows up in the order's payment history. */
    public PaymentTransaction recordRefund(Order order, BigDecimal amount, String gatewayNote) {
        String reference = "txn_" + UUID.randomUUID().toString().replace("-", "").substring(0, 20) + REFUND_SUFFIX;
        return paymentTransactionRepository.save(PaymentTransaction.builder()
                .order(order)
                .transactionId(reference)
                .paymentMethod(order.getPaymentMethod())
                .status(PaymentStatus.REFUNDED)
                .amount(scale(amount))
                .gatewayResponse(gatewayNote)
                .build());
    }

    public static String methodLabel(PaymentMethod method) {
        if (method == null) {
            return "original payment method";
        }
        return switch (method) {
            case CREDIT_CARD -> "credit card";
            case DEBIT_CARD -> "debit card";
            case PAYPAL -> "PayPal account";
            case STRIPE -> "Stripe payment method";
            case CASH_ON_DELIVERY -> "cash on delivery";
        };
    }

    public static String money(BigDecimal amount) {
        return "৳" + scale(orZero(amount)).toPlainString();
    }

    private String statusMessage(Order order, BigDecimal charged, BigDecimal refunded, BigDecimal net) {
        String method = methodLabel(order.getPaymentMethod());
        return switch (order.getPaymentStatus()) {
            case PENDING -> order.getPaymentMethod() == PaymentMethod.CASH_ON_DELIVERY
                    ? "Pay " + money(order.getTotalAmount()) + " in cash when your order is delivered."
                    : "Payment of " + money(order.getTotalAmount()) + " is pending.";
            case FAILED -> "The payment failed, so you have not been charged.";
            case REFUNDED -> "A refund of " + money(refunded) + " was issued to your " + method
                    + ". Refunds usually appear within 5-10 business days.";
            case COMPLETED -> refunded.signum() > 0
                    ? "Paid " + money(charged) + " by " + method + ". " + money(refunded)
                      + " was refunded, so you paid " + money(net) + " in total."
                    : "Paid " + money(charged) + " in full by " + method + ".";
        };
    }

    private OrderPaymentDetailsDto.Entry toEntry(PaymentTransaction row) {
        boolean refund = isRefund(row);
        return OrderPaymentDetailsDto.Entry.builder()
                .transactionId(row.getTransactionId())
                .kind(refund ? "REFUND" : "PAYMENT")
                .description(describe(row, refund))
                .status(row.getStatus())
                .amount(row.getAmount())
                .createdAt(row.getCreatedAt())
                .build();
    }

    private static String describe(PaymentTransaction row, boolean refund) {
        String gateway = row.getGatewayResponse() != null ? row.getGatewayResponse() : "";
        if (gateway.startsWith("SANDBOX_GROUP_BUY_PRICE_DROP_REFUND")) {
            return "Group price dropped after you joined";
        }
        if (gateway.startsWith("SANDBOX_ORDER_CANCELLED_REFUND")) {
            return "Refund for cancelled order";
        }
        if (gateway.startsWith("SANDBOX_GROUP_BUY_CAPTURE")) {
            return "Group buy payment captured at the final price";
        }
        if (gateway.startsWith("GATEWAY_REFUND_EXECUTED")) {
            return "Payment refunded in full";
        }
        if (refund) {
            return "Refund";
        }
        return row.getStatus() == PaymentStatus.PENDING ? "Payment authorization" : "Payment";
    }

    private static boolean isRefund(PaymentTransaction row) {
        return row.getTransactionId() != null && row.getTransactionId().endsWith(REFUND_SUFFIX);
    }

    private static BigDecimal orZero(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private static BigDecimal scale(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
