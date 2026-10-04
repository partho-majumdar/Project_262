package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.groupmart.dto.wholesale.WholesaleDisputeDto;
import com.groupmart.dto.wholesale.WholesaleOfferDto;
import com.groupmart.dto.wholesale.WholesalePoolDto;
import com.groupmart.dto.wholesale.WholesalePurchaseDto;
import com.groupmart.dto.wholesale.WholesaleReservationDto;
import com.groupmart.entity.*;
import com.groupmart.repository.WholesaleDisputeRepository;
import com.groupmart.repository.WholesalePoolRepository;
import com.groupmart.repository.WholesaleReservationRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static com.groupmart.service.impl.GroupBuyAdminMapper.fullName;
import static com.groupmart.service.impl.GroupBuyAdminMapper.orZero;

@Component
@RequiredArgsConstructor
public class WholesaleMapper {

    private final WholesalePoolRepository poolRepository;
    private final WholesaleDisputeRepository disputeRepository;
    private final WholesaleReservationRepository reservationRepository;

    public WholesaleOfferDto toOfferDto(WholesaleOffer offer) {
        Product product = offer.getProduct();
        SellerStore store = offer.getSellerStore();

        int active = 0;
        int completed = 0;
        int failed = 0;
        if (offer.getId() != null) {
            for (WholesalePool pool : poolRepository.findByOfferIdOrderByLotNumberDesc(offer.getId())) {
                switch (pool.getStatus()) {
                    case OPEN, ALMOST_COMPLETE -> active++;
                    case COMPLETED, PROCESSING, FULFILLMENT -> completed++;
                    case FAILED, CLOSED -> failed++;
                }
            }
        }

        List<String> images = product.getImageUrls();

        return WholesaleOfferDto.builder()
                .id(offer.getId())
                .productId(product.getId())
                .productName(product.getName())
                .productSlug(product.getSlug())
                .productImageUrl(images != null && !images.isEmpty() ? images.get(0) : null)
                .productPrice(product.getPrice())
                .sellerStoreId(store.getId())
                .sellerStoreName(store.getStoreName())
                .sellerStoreSlug(store.getStoreSlug())
                .status(offer.getStatus())
                .mode(offer.getMode())
                .wholesaleUnitPrice(offer.getWholesaleUnitPrice())
                .wholesaleMinimumQuantity(offer.getWholesaleMinimumQuantity())
                .maxAvailableQuantity(offer.getMaxAvailableQuantity())
                .minQuantityPerCustomer(offer.getMinQuantityPerCustomer())
                .maxQuantityPerCustomer(offer.getMaxQuantityPerCustomer())
                .reservationDeadline(offer.getReservationDeadline())
                .expectedFulfillmentNote(offer.getExpectedFulfillmentNote())
                .deliveryConditions(offer.getDeliveryConditions())
                .autoReopenNewLot(offer.isAutoReopenNewLot())
                .rejectionReason(offer.getRejectionReason())
                .submittedAt(offer.getSubmittedAt())
                .approvedAt(offer.getApprovedAt())
                .closedAt(offer.getClosedAt())
                .closeCode(offer.getCloseCode() != null ? offer.getCloseCode().name() : null)
                .closeReason(offer.getCloseCode() != null ? offer.getCloseCode().getLabel() : null)
                .createdAt(offer.getCreatedAt())
                .activeLotCount(active)
                .completedLotCount(completed)
                .failedLotCount(failed)
                .build();
    }

    public WholesalePoolDto toPoolDto(WholesalePool pool) {
        WholesaleOffer offer = pool.getOffer();
        Product product = offer.getProduct();
        SellerStore store = offer.getSellerStore();
        List<String> images = product.getImageUrls();

        // Fulfilment is read from the lot's orders instead of being stored, because the stored
        // status only ever reaches PROCESSING: it would report "Processing" forever even once
        // every customer order in the lot has been delivered.
        List<WholesaleReservation> lotReservations =
                reservationRepository.findByPoolIdOrderByCreatedAtAsc(pool.getId());
        int orderCount = 0;
        int deliveredOrderCount = 0;
        for (WholesaleReservation reservation : lotReservations) {
            Order linked = reservation.getOrder();
            if (linked == null) {
                continue;
            }
            orderCount++;
            if (linked.getStatus() == OrderStatus.DELIVERED) {
                deliveredOrderCount++;
            }
        }
        String fulfilmentStatus = orderCount == 0
                ? null
                : (deliveredOrderCount == orderCount
                    ? "FULFILLED"
                    : (deliveredOrderCount > 0 ? "PARTIALLY_FULFILLED" : "AWAITING_FULFILMENT"));

        return WholesalePoolDto.builder()
                .id(pool.getId())
                .offerId(offer.getId())
                .productId(product.getId())
                .productName(product.getName())
                .productImageUrl(images != null && !images.isEmpty() ? images.get(0) : null)
                .sellerStoreId(store.getId())
                .sellerStoreName(store.getStoreName())
                .lotNumber(pool.getLotNumber())
                .status(pool.getStatus())
                .wholesaleUnitPrice(pool.getWholesaleUnitPrice())
                .wholesaleMinimumQuantity(pool.getWholesaleMinimumQuantity())
                .lotCapacity(pool.getLotCapacity())
                .pooledQuantity(pool.getPooledQuantity())
                .remainingQuantity(pool.getRemainingQuantity())
                .participantCount(pool.getParticipantCount())
                .minQuantityPerCustomer(offer.getMinQuantityPerCustomer())
                .maxQuantityPerCustomer(offer.getMaxQuantityPerCustomer())
                .deadline(pool.getDeadline())
                .completedAt(pool.getCompletedAt())
                .closedAt(pool.getClosedAt())
                .closeCode(pool.getCloseCode() != null ? pool.getCloseCode().name() : null)
                .closeReasonLabel(pool.getCloseCode() != null ? pool.getCloseCode().getLabel() : null)
                .fulfilmentStatus(fulfilmentStatus)
                .orderCount(orderCount)
                .deliveredOrderCount(deliveredOrderCount)
                .allOrdersDelivered(fulfilmentStatus != null && "FULFILLED".equals(fulfilmentStatus))
                .createdAt(pool.getCreatedAt())
                .build();
    }

    public WholesalePurchaseDto toPurchaseDto(WholesalePurchase purchase) {
        WholesalePool pool = purchase.getPool();
        WholesaleOffer offer = pool.getOffer();
        Product product = offer.getProduct();

        return WholesalePurchaseDto.builder()
                .id(purchase.getId())
                .poolId(pool.getId())
                .offerId(offer.getId())
                .productId(product.getId())
                .productName(product.getName())
                .confirmedUnitPrice(purchase.getConfirmedUnitPrice())
                .totalConfirmedQuantity(purchase.getTotalConfirmedQuantity())
                .participantCount(purchase.getParticipantCount())
                .confirmedAt(purchase.getConfirmedAt())
                .build();
    }

    public WholesaleDisputeDto toDisputeDto(WholesaleDispute dispute) {
        WholesaleReservation reservation = dispute.getReservation();
        WholesalePool pool = reservation.getPool();
        WholesaleOffer offer = pool.getOffer();
        User customer = dispute.getRaisedBy();
        Order order = reservation.getOrder();
        BigDecimal disputeRefunds = orZero(disputeRepository.sumRefundsByReservation(reservation.getId()));

        return WholesaleDisputeDto.builder()
                .id(dispute.getId())
                .type(dispute.getType())
                .typeLabel(dispute.getType().getLabel())
                .status(dispute.getStatus())
                .description(dispute.getDescription())
                .resolutionNote(dispute.getResolutionNote())
                .refundAmount(orZero(dispute.getRefundAmount()))
                .reservationId(reservation.getId())
                .customerId(customer.getId())
                .customerName(fullName(customer))
                .customerEmail(customer.getEmail())
                .offerId(offer.getId())
                .poolId(pool.getId())
                .lotNumber(pool.getLotNumber())
                .productName(offer.getProduct().getName())
                .sellerStoreName(offer.getSellerStore().getStoreName())
                .quantity(reservation.getQuantity())
                .totalAmount(reservation.getTotalAmount())
                .refundedSoFar(orZero(reservation.getRefundAmount()).add(disputeRefunds))
                .maxRefundable(maxRefundable(reservation, disputeRefunds))
                .orderId(order != null ? order.getId() : null)
                .orderNumber(order != null ? order.getOrderNumber() : null)
                .orderStatus(order != null ? order.getStatus().name() : null)
                .handledByName(dispute.getHandledBy() != null ? fullName(dispute.getHandledBy()) : null)
                .resolvedAt(dispute.getResolvedAt())
                .createdAt(dispute.getCreatedAt())
                .updatedAt(dispute.getUpdatedAt())
                .build();
    }

    /**
     * Only a reservation that converted into an order still holds money: a reservation cancelled
     * before pool completion, or refunded after pool failure, was already refunded in full.
     */
    public static BigDecimal maxRefundable(WholesaleReservation reservation, BigDecimal disputeRefunds) {
        if (reservation.getStatus() != WholesaleReservationStatus.CONVERTED || reservation.getOrder() == null) {
            return BigDecimal.ZERO;
        }
        return orZero(reservation.getTotalAmount())
                .subtract(orZero(reservation.getRefundAmount()))
                .subtract(orZero(disputeRefunds))
                .max(BigDecimal.ZERO);
    }

    public WholesaleReservationDto toReservationDto(WholesaleReservation reservation) {
        WholesalePool pool = reservation.getPool();
        WholesaleOffer offer = pool.getOffer();
        Product product = offer.getProduct();
        List<String> images = product.getImageUrls();
        Order order = reservation.getOrder();

        return WholesaleReservationDto.builder()
                .id(reservation.getId())
                .poolId(pool.getId())
                .offerId(offer.getId())
                .productId(product.getId())
                .productName(product.getName())
                .productImageUrl(images != null && !images.isEmpty() ? images.get(0) : null)
                .quantity(reservation.getQuantity())
                .unitPriceAtReservation(reservation.getUnitPriceAtReservation())
                .deliveryCharge(reservation.getDeliveryCharge())
                .totalAmount(reservation.getTotalAmount())
                .refundAmount(reservation.getRefundAmount())
                .status(reservation.getStatus())
                .paymentStatus(reservation.getPaymentStatus())
                .paymentMethod(reservation.getPaymentMethod())
                .orderId(order != null ? order.getId() : null)
                .orderNumber(order != null ? order.getOrderNumber() : null)
                .orderStatus(order != null ? order.getStatus().name() : null)
                .poolPooledQuantity(pool.getPooledQuantity())
                .poolCapacity(pool.getLotCapacity())
                .poolStatus(pool.getStatus().name())
                .poolDeadline(pool.getDeadline())
                .reservedAt(reservation.getReservedAt())
                .cancelledAt(reservation.getCancelledAt())
                .createdAt(reservation.getCreatedAt())
                .build();
    }
}
