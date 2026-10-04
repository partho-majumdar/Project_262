package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.groupmart.dto.reverse.ReverseGroupBuyingCampaignDto;
import com.groupmart.dto.reverse.ReverseGroupBuyingOfferDto;
import com.groupmart.dto.reverse.ReverseGroupBuyingParticipationDto;
import com.groupmart.entity.Order;
import com.groupmart.entity.Product;
import com.groupmart.entity.ReverseGroupBuyingCampaign;
import com.groupmart.entity.ReverseGroupBuyingOffer;
import com.groupmart.entity.ReverseGroupBuyingParticipation;
import com.groupmart.entity.ReverseTargetType;

import java.math.BigDecimal;
import java.util.List;

/**
 * Maps Reverse Group Buying entities to their API shape. Kept separate from {@link WholesaleMapper}
 * so the Reverse Group Buying read model can never drift into the CWP one.
 */
@Component
@RequiredArgsConstructor
public class ReverseGroupBuyingMapper {

    public ReverseGroupBuyingOfferDto toOfferDto(ReverseGroupBuyingOffer offer) {
        Product product = offer.getProduct();
        List<String> images = product.getImageUrls();
        int progress = offer.getTargetProgressPercent();

        return ReverseGroupBuyingOfferDto.builder()
                .id(offer.getId())
                .productId(product.getId())
                .productName(product.getName())
                .productSlug(product.getSlug())
                .productImageUrl(images != null && !images.isEmpty() ? images.get(0) : null)
                .productPrice(product.getPrice())
                .sellerStoreId(offer.getSellerStore().getId())
                .sellerStoreName(offer.getSellerStore().getStoreName())
                .sellerStoreSlug(offer.getSellerStore().getStoreSlug())
                .status(offer.getStatus())
                .description(offer.getDescription())
                .basePrice(offer.getBasePrice())
                .availableQuantity(offer.getAvailableQuantity())
                .targetType(offer.getTargetType())
                .targetTypeLabel(targetTypeLabel(offer.getTargetType()))
                .targetValue(offer.getTargetValue())
                .targetQuantity(offer.getTargetQuantity())
                .unlockedUnitPrice(offer.getUnlockedUnitPrice())
                .minQuantityPerCustomer(offer.getMinQuantityPerCustomer())
                .maxQuantityPerCustomer(offer.getMaxQuantityPerCustomer())
                .participationDeadline(offer.getParticipationDeadline())
                .currentDemand(offer.getCurrentDemand())
                .remainingDemand(offer.getRemainingDemand())
                .remainingToTarget(offer.getRemainingToTarget())
                .participantCount(offer.getParticipantCount())
                .targetProgressPercent(progress)
                .targetReached(offer.isTargetReached())
                .acceptsDemand(offer.getStatus().acceptsDemand())
                .targetReachedAt(offer.getTargetReachedAt())
                .activatedAt(offer.getActivatedAt())
                .closedAt(offer.getClosedAt())
                .closeCode(offer.getCloseCode())
                .closeReasonLabel(offer.getCloseCode() != null ? offer.getCloseCode().getLabel() : null)
                .closeNote(offer.getCloseNote())
                .createdAt(offer.getCreatedAt())
                .build();
    }

    public ReverseGroupBuyingParticipationDto toParticipationDto(ReverseGroupBuyingParticipation participation) {
        ReverseGroupBuyingOffer offer = participation.getOffer();
        Product product = offer.getProduct();
        List<String> images = product.getImageUrls();
        Order order = participation.getOrder();

        return ReverseGroupBuyingParticipationDto.builder()
                .id(participation.getId())
                .offerId(offer.getId())
                .productId(product.getId())
                .productName(product.getName())
                .productImageUrl(images != null && !images.isEmpty() ? images.get(0) : null)
                .basePrice(offer.getBasePrice())
                .quantity(participation.getQuantity())
                .unitPrice(participation.getUnitPrice())
                .totalAmount(participation.getTotalAmount())
                .refundAmount(participation.getRefundAmount())
                .status(participation.getStatus())
                .paymentStatus(participation.getPaymentStatus())
                .paymentMethod(participation.getPaymentMethod())
                .orderId(order != null ? order.getId() : null)
                .orderNumber(order != null ? order.getOrderNumber() : null)
                .orderStatus(order != null ? order.getStatus().name() : null)
                .orderPaymentStatus(order != null ? order.getPaymentStatus().name() : null)
                .offerCurrentDemand(offer.getCurrentDemand())
                .offerTargetQuantity(offer.getTargetQuantity())
                .offerParticipantCount(offer.getParticipantCount())
                .offerProgressPercent(offer.getTargetProgressPercent())
                .offerTargetReached(offer.isTargetReached())
                .offerStatus(offer.getStatus().name())
                .offerUnlockedUnitPrice(offer.getUnlockedUnitPrice())
                .offerDeadline(offer.getParticipationDeadline())
                .participatedAt(participation.getParticipatedAt())
                .cancelledAt(participation.getCancelledAt())
                .createdAt(participation.getCreatedAt())
                .build();
    }

    public ReverseGroupBuyingCampaignDto toCampaignDto(ReverseGroupBuyingCampaign campaign) {
        return ReverseGroupBuyingCampaignDto.builder()
                .id(campaign.getId())
                .offerId(campaign.getOffer().getId())
                .productId(campaign.getOffer().getProduct().getId())
                .productName(campaign.getOffer().getProduct().getName())
                .targetType(campaign.getTargetType())
                .unlockedUnitPrice(campaign.getUnlockedUnitPrice())
                .basePriceAtActivation(campaign.getBasePriceAtActivation())
                .targetQuantity(campaign.getTargetQuantity())
                .totalConfirmedQuantity(campaign.getTotalConfirmedQuantity())
                .participantCount(campaign.getParticipantCount())
                .activatedAt(campaign.getActivatedAt())
                .build();
    }

    private static String targetTypeLabel(ReverseTargetType type) {
        if (type == null) {
            return null;
        }
        return switch (type) {
            case TARGET_QUANTITY -> "Collective quantity target";
            case TARGET_PRICE -> "Target price unlocked by demand";
            case DISCOUNT_THRESHOLD -> "Discount threshold unlocked by demand";
        };
    }

    /** Guards against a null BigDecimal leaking into arithmetic anywhere downstream. */
    public static BigDecimal orZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
