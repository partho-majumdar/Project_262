package com.groupmart.dto.wholesale;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.groupmart.entity.PaymentMethod;
import com.groupmart.entity.PaymentStatus;
import com.groupmart.entity.WholesaleReservationStatus;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WholesaleReservationDto {

    private UUID id;
    private UUID poolId;
    private UUID offerId;
    private UUID productId;
    private String productName;
    private String productImageUrl;
    private int quantity;
    private BigDecimal unitPriceAtReservation;
    private BigDecimal deliveryCharge;
    private BigDecimal totalAmount;
    private BigDecimal refundAmount;
    private WholesaleReservationStatus status;
    private PaymentStatus paymentStatus;
    private PaymentMethod paymentMethod;
    private UUID orderId;
    private String orderNumber;
    /** Status of the order this reservation became, so the customer can see delivery progress. */
    private String orderStatus;
    private int poolPooledQuantity;
    private int poolCapacity;
    private String poolStatus;
    private LocalDateTime poolDeadline;
    private LocalDateTime reservedAt;
    private LocalDateTime cancelledAt;
    private LocalDateTime createdAt;
}
