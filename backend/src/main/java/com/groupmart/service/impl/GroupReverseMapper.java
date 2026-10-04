package com.groupmart.service.impl;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.groupmart.dto.groupr.GroupReverseDemandDto;
import com.groupmart.dto.groupr.GroupReverseMemberDto;
import com.groupmart.dto.groupr.GroupReverseOfferDto;
import com.groupmart.entity.GroupReverseDemand;
import com.groupmart.entity.GroupReverseMember;
import com.groupmart.entity.GroupReverseMemberStatus;
import com.groupmart.entity.GroupReverseOffer;
import com.groupmart.entity.GroupReverseOfferStatus;
import com.groupmart.entity.Product;

/**
 * Turns group reverse demand rows into responses.
 * <p>
 * Two privacy boundaries live here rather than in the services, so they cannot be forgotten at a
 * call site: {@link #toOfferDto} never exposes anything about the members beyond the group size,
 * and {@link #toMemberDto} is only ever called with a caller who is entitled to see the person
 * named in it.
 */
@Component
@RequiredArgsConstructor
public class GroupReverseMapper {

    /** Membership status wording. */
    public static final Map<String, String> MEMBER_STATUS_LABEL = Map.of(
            "JOINED", "In the group",
            "CANCELLED", "Left the group",
            "CONFIRMED", "Confirmed",
            "ORDER_CREATED", "Order created");

    private static final Map<String, String> OFFER_STATUS_LABEL = Map.of(
            "SUBMITTED", "Awaiting the creator's decision",
            "ACCEPTED", "Selected",
            "CLOSED", "Closed",
            "EXPIRED", "Expired",
            "WITHDRAWN", "Withdrawn");

    public GroupReverseDemandDto toDemandDto(GroupReverseDemand demand, LocalDateTime now) {
        Product product = demand.getProduct();
        GroupReverseOffer selected = demand.getSelectedOffer();

        return GroupReverseDemandDto.builder()
                .id(demand.getId())
                .productId(product.getId())
                .productName(product.getName())
                .productImageUrl(firstImage(product))
                .productPrice(product.getPrice())
                .leaderId(demand.getLeader().getId())
                .leaderName(demand.getLeader().getFirstName() + " " + demand.getLeader().getLastName())
                .status(demand.getStatus())
                .statusLabel(demand.getStatus().name().replace('_', ' '))
                .description(demand.getDescription())
                .requiredQuantity(demand.getRequiredQuantity())
                .committedQuantity(demand.getCommittedQuantity())
                .remainingQuantity(demand.getRemainingQuantity())
                .progressPercent(demand.getProgressPercent())
                .memberCount(demand.getMemberCount())
                .offerCount(demand.getOfferCount())
                .targetPrice(demand.getTargetPrice())
                .maxPrice(demand.getMaxPrice())
                .minQuantityPerMember(demand.getMinQuantityPerMember())
                .maxQuantityPerMember(demand.getMaxQuantityPerMember())
                .joinDeadline(demand.getJoinDeadline())
                .offerDeadline(demand.getOfferDeadline())
                .deliveryCity(demand.getDeliveryCity())
                .requiredDeliveryDate(demand.getRequiredDeliveryDate())
                .serverTime(now)
                .timeToJoinDeadlineSeconds(secondsUntil(demand.getJoinDeadline(), now))
                .timeToOfferDeadlineSeconds(secondsUntil(demand.getOfferDeadline(), now))
                .canJoin(demand.getStatus().acceptsMembers() && demand.getJoinDeadline().isAfter(now))
                .acceptingOffers(demand.getStatus().acceptsOffers() && demand.getOfferDeadline().isAfter(now))
                .selectedOfferId(selected == null ? null : selected.getId())
                .selectedSellerStoreId(selected == null ? null : selected.getSellerStore().getId())
                .selectedSellerStoreName(selected == null ? null : selected.getSellerStore().getStoreName())
                .lockedUnitPrice(demand.getLockedUnitPrice())
                .lockedDeliveryFee(demand.getLockedDeliveryFee())
                .lockedEstimatedDeliveryDays(demand.getLockedEstimatedDeliveryDays())
                .lockedWarrantyMonths(demand.getLockedWarrantyMonths())
                .finalGroupTotal(groupTotal(demand))
                .closeCode(demand.getCloseCode() == null ? null : demand.getCloseCode().name())
                .closeNote(demand.getCloseNote())
                .publishedAt(demand.getPublishedAt())
                .targetReachedAt(demand.getTargetReachedAt())
                .offerSelectedAt(demand.getOfferSelectedAt())
                .closedAt(demand.getClosedAt())
                .createdAt(demand.getCreatedAt())
                .build();
    }

    public GroupReverseMemberDto toMemberDto(GroupReverseMember member) {
        BigDecimal total = member.computeTotal();
        return GroupReverseMemberDto.builder()
                .id(member.getId())
                .demandId(member.getDemand().getId())
                .productName(member.getDemand().getProduct().getName())
                .customerId(member.getCustomer().getId())
                .customerName(member.getCustomer().getFirstName() + " "
                        + member.getCustomer().getLastName())
                .requestedQuantity(member.getRequestedQuantity())
                .status(member.getStatus())
                .statusLabel(MEMBER_STATUS_LABEL.getOrDefault(member.getStatus().name(),
                        member.getStatus().name()))
                .paymentMethod(member.getPaymentMethod())
                .paymentStatus(member.getOrder() == null ? null : member.getOrder().getPaymentStatus())
                .shippingCity(member.getShippingCity())
                .shippingState(member.getShippingState())
                .shippingCountry(member.getShippingCountry())
                .lockedUnitPrice(member.getLockedUnitPrice())
                .deliveryFeeShare(member.getDeliveryFeeShare())
                .totalAmount(total)
                .amountPaid(member.getAmountPaid())
                .orderId(member.getOrder() == null ? null : member.getOrder().getId())
                .orderNumber(member.getOrderNumber())
                .orderStatus(member.getOrder() == null ? null : member.getOrder().getStatus().name())
                .joinedAt(member.getJoinedAt())
                .cancelledAt(member.getCancelledAt())
                .cancellationReason(member.getCancellationReason())
                .build();
    }

    /**
     * A member record with the customer stripped out, for views a seller may read.
     * <p>
     * A seller needs to know the group is four customers worth fifty units; it does not need their
     * names, their cities or anything else that identifies them.
     */
    public GroupReverseMemberDto toAnonymousMemberDto(GroupReverseMember member) {
        GroupReverseMemberDto dto = toMemberDto(member);
        dto.setCustomerId(null);
        dto.setCustomerName(null);
        dto.setShippingCity(null);
        dto.setShippingState(null);
        dto.setShippingCountry(null);
        return dto;
    }

    public GroupReverseOfferDto toOfferDto(GroupReverseOffer offer, LocalDateTime now) {
        GroupReverseDemand demand = offer.getDemand();
        BigDecimal groupTotal = offer.computeGroupTotal();
        BigDecimal perUnit = demand.getCommittedQuantity() <= 0
                ? null
                : groupTotal.divide(BigDecimal.valueOf(demand.getCommittedQuantity()), 2,
                        java.math.RoundingMode.HALF_UP);

        return GroupReverseOfferDto.builder()
                .id(offer.getId())
                .demandId(demand.getId())
                .productName(demand.getProduct().getName())
                .requiredQuantity(demand.getRequiredQuantity())
                .sellerStoreId(offer.getSellerStore().getId())
                .sellerStoreName(offer.getSellerStore().getStoreName())
                .sellerStoreSlug(offer.getSellerStore().getStoreSlug())
                .unitPrice(offer.getUnitPrice())
                .offeredQuantity(offer.getOfferedQuantity())
                .deliveryFee(offer.getDeliveryFee())
                .groupTotal(groupTotal)
                .effectiveUnitPriceIncludingDelivery(perUnit)
                .estimatedDeliveryDays(offer.getEstimatedDeliveryDays())
                .warrantyMonths(offer.getWarrantyMonths())
                .message(offer.getMessage())
                .status(offer.getStatus())
                .statusLabel(OFFER_STATUS_LABEL.getOrDefault(offer.getStatus().name(),
                        offer.getStatus().name()))
                .offerExpiry(offer.getOfferExpiry())
                .selectable(offer.isSelectable(now) && demand.getStatus().acceptsOffers())
                .accepted(offer.getStatus() == GroupReverseOfferStatus.ACCEPTED)
                .meetsTargetPrice(demand.getTargetPrice() == null
                        || offer.getUnitPrice().compareTo(demand.getTargetPrice()) <= 0)
                .createdAt(offer.getCreatedAt())
                .build();
    }

    private BigDecimal groupTotal(GroupReverseDemand demand) {
        if (demand.getLockedUnitPrice() == null) {
            return null;
        }
        BigDecimal total = demand.getLockedUnitPrice()
                .multiply(BigDecimal.valueOf(demand.getCommittedQuantity()));
        if (demand.getLockedDeliveryFee() != null) {
            total = total.add(demand.getLockedDeliveryFee());
        }
        return total;
    }

    private String firstImage(Product product) {
        return product.getImageUrls() == null || product.getImageUrls().isEmpty()
                ? null
                : product.getImageUrls().get(0);
    }

    static long secondsUntil(LocalDateTime target, LocalDateTime now) {
        if (target == null) {
            return 0L;
        }
        return Math.max(0L, Duration.between(now, target).getSeconds());
    }
}
