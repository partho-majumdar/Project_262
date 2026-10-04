package com.groupmart.service.impl;

import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.groupmart.dto.auction.AuctionParticipationDto;
import com.groupmart.dto.auction.AuctionResultDto;
import com.groupmart.dto.auction.AuctionTierDto;
import com.groupmart.dto.auction.GroupBuyingAuctionDto;
import com.groupmart.entity.*;
import com.groupmart.repository.GroupBuyingAuctionTierRepository;
import com.groupmart.service.AuctionPricingService;

/**
 * Maps Group Buying Auction entities to their API shape, including the seller-configured price ladder
 * and the read-only price projection. Separate from {@link WholesaleMapper} so the auction read model
 * can never borrow CWP concepts.
 */
@Component
@RequiredArgsConstructor
public class GroupBuyingAuctionMapper {

    private final GroupBuyingAuctionTierRepository tierRepository;
    private final AuctionPricingService pricingService;

    public GroupBuyingAuctionDto toAuctionDto(GroupBuyingAuction auction) {
        Product product = auction.getProduct();
        List<String> images = product.getImageUrls();
        List<AuctionTierDto> tiers = auction.getId() == null ? List.of()
                : tierRepository.findByAuctionIdOrderByMinQuantityAsc(auction.getId()).stream()
                        .map(AuctionPricingServiceImpl::toTierDto)
                        .toList();

        return GroupBuyingAuctionDto.builder()
                .id(auction.getId())
                .productId(product.getId())
                .productName(product.getName())
                .productSlug(product.getSlug())
                .productImageUrl(images != null && !images.isEmpty() ? images.get(0) : null)
                .productPrice(product.getPrice())
                .sellerStoreId(auction.getSellerStore().getId())
                .sellerStoreName(auction.getSellerStore().getStoreName())
                .sellerStoreSlug(auction.getSellerStore().getStoreSlug())
                .status(auction.getStatus())
                .description(auction.getDescription())
                .startingPrice(auction.getStartingPrice())
                .minimumSellerUnitPrice(auction.getMinimumSellerUnitPrice())
                .availableQuantity(auction.getAvailableQuantity())
                .minimumCollectiveQuantity(auction.getMinimumCollectiveQuantity())
                .minQuantityPerCustomer(auction.getMinQuantityPerCustomer())
                .maxQuantityPerCustomer(auction.getMaxQuantityPerCustomer())
                .startsAt(auction.getStartsAt())
                .endsAt(auction.getEndsAt())
                .pricingRule(auction.getPricingRule())
                .discountPercent(auction.getDiscountPercent())
                .tiers(tiers)
                .collectiveQuantity(auction.getCollectiveQuantity())
                .remainingQuantity(auction.getRemainingQuantity())
                .remainingToMinimum(auction.getRemainingToMinimum())
                .participantCount(auction.getParticipantCount())
                .finalUnitPrice(auction.getFinalUnitPrice())
                .finalized(auction.getFinalUnitPrice() != null)
                .finalizedAt(auction.getFinalizedAt())
                .projectedUnitPrice(auction.getFinalUnitPrice() != null
                        ? auction.getFinalUnitPrice()
                        : pricingService.calculateUnitPrice(auction, auction.getCollectiveQuantity()))
                .closeCode(auction.getCloseCode())
                .closeReasonLabel(auction.getCloseCode() != null ? auction.getCloseCode().getLabel() : null)
                .closeNote(auction.getCloseNote())
                .createdAt(auction.getCreatedAt())
                .build();
    }

    public AuctionParticipationDto toParticipationDto(GroupBuyingAuctionParticipation participation) {
        GroupBuyingAuction auction = participation.getAuction();
        Product product = auction.getProduct();
        List<String> images = product.getImageUrls();
        Order order = participation.getOrder();
        OrderItem orderItem = order == null || order.getItems().isEmpty() ? null : order.getItems().get(0);

        return AuctionParticipationDto.builder()
                .id(participation.getId())
                .auctionId(auction.getId())
                .userName(participation.getUser() == null ? null
                        : (participation.getUser().getFirstName() + " "
                                + participation.getUser().getLastName()).trim())
                .userEmail(participation.getUser() == null ? null : participation.getUser().getEmail())
                .productId(product.getId())
                .productName(product.getName())
                .productImageUrl(images != null && !images.isEmpty() ? images.get(0) : null)
                .productPrice(product.getPrice())
                .quantity(participation.getQuantity())
                .maxUnitPrice(participation.getMaxUnitPrice())
                .totalAmount(participation.getTotalAmount())
                .refundAmount(participation.getRefundAmount())
                .status(participation.getStatus())
                .paymentStatus(participation.getPaymentStatus())
                .paymentMethod(participation.getPaymentMethod())
                .orderId(order != null ? order.getId() : null)
                .orderNumber(order != null ? order.getOrderNumber() : null)
                .orderStatus(order != null ? order.getStatus().name() : null)
                .orderUnitPrice(orderItem != null ? orderItem.getUnitPrice() : null)
                .auctionStatus(auction.getStatus().name())
                .auctionCollectiveQuantity(auction.getCollectiveQuantity())
                .auctionMinimumCollectiveQuantity(auction.getMinimumCollectiveQuantity())
                .auctionParticipantCount(auction.getParticipantCount())
                .auctionEndsAt(auction.getEndsAt())
                .auctionFinalUnitPrice(auction.getFinalUnitPrice())
                .bidAt(participation.getBidAt())
                .cancelledAt(participation.getCancelledAt())
                .createdAt(participation.getCreatedAt())
                .build();
    }

    public AuctionResultDto toResultDto(GroupBuyingAuctionResult result) {
        return toResultDto(result, null, null, null);
    }

    /**
     * The locked outcome, with the settled figures derived from the participations and orders.
     * <p>
     * The quantity and revenue aggregates are recomputed on read rather than served from the result
     * row. A result row finalized before those columns existed stores zeroes, and because
     * finalization is one-shot it is never rewritten - so a seller looking at an older settled
     * auction would be shown "0 units sold" next to three delivered orders. Deriving from the WON
     * participations and their orders is stable (a finalized auction's bids never change again) and
     * cannot report zero against orders that exist.
     */
    public AuctionResultDto toResultDto(GroupBuyingAuctionResult result, Integer wonQuantity,
                                        Integer outbidQuantity, java.math.BigDecimal salesTotal) {
        GroupBuyingAuction auction = result.getAuction();
        // Fall back to the stored figures only when the auction has no participations at all to
        // derive from, so the mapper stays usable in contexts that do not load them.
        int winningQuantity = wonQuantity != null ? wonQuantity : result.getWinningQuantity();
        int outbidQuantitySum = outbidQuantity != null ? outbidQuantity : result.getOutbidQuantity();
        java.math.BigDecimal sales = salesTotal != null ? salesTotal : result.getTotalSuccessfulSales();

        return AuctionResultDto.builder()
                .id(result.getId())
                .auctionId(auction.getId())
                .productId(auction.getProduct().getId())
                .productName(auction.getProduct().getName())
                .pricingRule(result.getPricingRule())
                .finalUnitPrice(result.getFinalUnitPrice())
                .startingPriceAtFinalization(result.getStartingPriceAtFinalization())
                .collectiveQuantity(result.getCollectiveQuantity())
                .bidderCount(result.getBidderCount())
                .winningBidCount(result.getWinningBidCount())
                .outbidCount(result.getOutbidCount())
                .winningQuantity(winningQuantity)
                .outbidQuantity(outbidQuantitySum)
                .totalSuccessfulSales(sales)
                .minimumSellerUnitPrice(result.getMinimumSellerUnitPrice())
                .finalizedAt(result.getFinalizedAt())
                .finalizedByName(result.getFinalizedBy() == null ? null
                        : result.getFinalizedBy().getFirstName() + " " + result.getFinalizedBy().getLastName())
                .build();
    }
}
