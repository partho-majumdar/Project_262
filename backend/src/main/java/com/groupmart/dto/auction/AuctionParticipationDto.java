package com.groupmart.dto.auction;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.groupmart.entity.AuctionParticipationStatus;
import com.groupmart.entity.PaymentMethod;
import com.groupmart.entity.PaymentStatus;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuctionParticipationDto {

    private UUID id;
    private UUID auctionId;

    /**
     * The bidder's identity.
     * <p>
     * Only ever populated for a row the caller is entitled to see: a customer reading their own
     * participations, or a seller reading the bids on an auction they own. There is no public route
     * that lists an auction's bids, so a bidder's identity is never exposed to other customers.
     */
    private String userName;
    private String userEmail;

    private UUID productId;
    private String productName;
    private String productImageUrl;
    private BigDecimal productPrice;

    private int quantity;
    private BigDecimal maxUnitPrice;
    private BigDecimal totalAmount;
    private BigDecimal refundAmount;
    private AuctionParticipationStatus status;
    private PaymentStatus paymentStatus;
    private PaymentMethod paymentMethod;

    private UUID orderId;
    private String orderNumber;
    private String orderStatus;
    private BigDecimal orderUnitPrice;

    private String auctionStatus;
    private int auctionCollectiveQuantity;
    private int auctionMinimumCollectiveQuantity;
    private int auctionParticipantCount;
    private LocalDateTime auctionEndsAt;
    private BigDecimal auctionFinalUnitPrice;

    private LocalDateTime bidAt;
    private LocalDateTime cancelledAt;
    private LocalDateTime createdAt;
}
