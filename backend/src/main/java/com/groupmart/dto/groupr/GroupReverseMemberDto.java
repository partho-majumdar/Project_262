package com.groupmart.dto.groupr;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.groupmart.entity.GroupReverseMemberStatus;
import com.groupmart.entity.PaymentMethod;
import com.groupmart.entity.PaymentStatus;

/**
 * One member's participation.
 * <p>
 * <b>Privacy split.</b> In the member's own view (and the leader's) this carries their full record.
 * In the seller-facing and public list views the same shape is used with the customer identity
 * omitted, so a seller can see how large the group is without learning who is in it.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupReverseMemberDto {

    private UUID id;
    private UUID demandId;
    private String productName;

    private UUID customerId;
    private String customerName;

    private int requestedQuantity;
    private GroupReverseMemberStatus status;
    private String statusLabel;

    private PaymentMethod paymentMethod;
    private PaymentStatus paymentStatus;

    private String shippingCity;
    private String shippingState;
    private String shippingCountry;

    private BigDecimal lockedUnitPrice;
    private BigDecimal deliveryFeeShare;
    /** What this member owes: their own quantity at the locked price, plus their delivery share. */
    private BigDecimal totalAmount;
    private BigDecimal amountPaid;

    private UUID orderId;
    private String orderNumber;
    private String orderStatus;

    private LocalDateTime joinedAt;
    private LocalDateTime cancelledAt;
    private String cancellationReason;
}
