package com.groupmart.dto.order;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.groupmart.entity.PaymentMethod;
import com.groupmart.entity.PaymentStatus;

/** Payment and refund breakdown shown on order detail pages. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderPaymentDetailsDto {

    private PaymentMethod paymentMethod;
    private PaymentStatus paymentStatus;
    /** Plain-language summary, e.g. "Refund of ৳12.00 issued to your PayPal account". */
    private String statusMessage;
    private BigDecimal amountCharged;
    private BigDecimal refundedAmount;
    private BigDecimal netPaid;
    private List<Entry> transactions;
    private GroupBuy groupBuy;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Entry {
        private String transactionId;
        /** PAYMENT or REFUND */
        private String kind;
        private String description;
        private PaymentStatus status;
        private BigDecimal amount;
        private LocalDateTime createdAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GroupBuy {
        private BigDecimal unitPriceAtJoin;
        private BigDecimal amountPaidAtJoin;
        private BigDecimal finalUnitPrice;
        private BigDecimal priceDropRefund;
        private int quantity;
        private String paymentReference;
        private LocalDateTime paidAt;
    }
}
