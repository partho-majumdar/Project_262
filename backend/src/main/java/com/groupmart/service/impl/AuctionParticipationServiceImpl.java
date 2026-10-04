package com.groupmart.service.impl;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.auction.AuctionParticipationDto;
import com.groupmart.dto.auction.AuctionParticipationRequest;
import com.groupmart.dto.notification.SendNotificationRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.AuctionParticipationService;
import com.groupmart.service.NotificationService;

/**
 * Customers bidding in a Group Buying Auction, independently of one another.
 * <p>
 * A bid is "N units at up to P per unit". The auction mechanism later sets one clearing price for
 * everyone; this service only validates and records the bid and keeps the collective quantity and
 * sellable stock correct under concurrency. It never computes a final price and never uses a CWP
 * wholesale price.
 */
@Service
@RequiredArgsConstructor
public class AuctionParticipationServiceImpl implements AuctionParticipationService {

    private static final Set<PaymentMethod> ONLINE_PAYMENT_METHODS = EnumSet.of(
            PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD, PaymentMethod.PAYPAL, PaymentMethod.STRIPE);

    private final GroupBuyingAuctionRepository auctionRepository;
    private final GroupBuyingAuctionParticipationRepository participationRepository;
    private final UserRepository userRepository;
    private final AddressRepository addressRepository;
    private final ReservedStockManager stockManager;
    private final NotificationService notificationService;
    private final GroupBuyingAuctionMapper mapper;

    @Override
    @Transactional
    public AuctionParticipationDto placeBid(String userEmail, UUID auctionId, AuctionParticipationRequest request) {
        User user = requireUser(userEmail);
        // Row-locked so concurrent bids serialize on this auction's collective quantity.
        GroupBuyingAuction auction = auctionRepository.findByIdForUpdate(auctionId)
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyingAuction", "id", auctionId));

        LocalDateTime now = LocalDateTime.now();
        if (!auction.getStatus().acceptsBids()) {
            throw bad("This auction is not accepting bids");
        }
        if (auction.getStartsAt().isAfter(now)) {
            throw bad("This auction has not started yet");
        }
        if (!auction.getEndsAt().isAfter(now)) {
            // Server-side deadline: the frontend clock is never trusted.
            throw bad("This auction has ended and is awaiting its result");
        }

        int quantity = request.getQuantity();
        if (quantity < auction.getMinQuantityPerCustomer()) {
            throw bad("Minimum quantity per customer is " + auction.getMinQuantityPerCustomer());
        }
        if (quantity > auction.getMaxQuantityPerCustomer()) {
            throw bad("Maximum quantity per customer is " + auction.getMaxQuantityPerCustomer());
        }
        int alreadyBid = participationRepository.sumActiveQuantityByAuctionAndUser(auctionId, user.getId());
        if (alreadyBid + quantity > auction.getMaxQuantityPerCustomer()) {
            throw bad("You have already bid " + alreadyBid + " unit(s) here; the limit is "
                    + auction.getMaxQuantityPerCustomer() + " unit(s) per customer");
        }
        if (quantity > auction.getRemainingQuantity()) {
            throw bad("Only " + auction.getRemainingQuantity() + " more unit(s) can be bid in this auction");
        }

        BigDecimal maxUnitPrice = request.getMaxUnitPrice();
        if (maxUnitPrice.compareTo(auction.getProduct().getPrice()) > 0) {
            throw bad("A bid cannot exceed the regular price of " + auction.getProduct().getPrice() + " per unit");
        }

        Address address = addressRepository.findByIdAndUserId(request.getAddressId(), user.getId())
                .orElseThrow(() -> bad("Select a valid shipping address"));
        validatePaymentMethod(request.getPaymentMethod());

        // Reserve the units so the auction can never sell more than the seller physically has.
        stockManager.reserve(auction.getProduct(), auction.getSellerStore(), quantity,
                "AUCTION_RESERVE", "AUCTION:" + auction.getId() + ":BIDDER:" + user.getId());

        ShippingSnapshot shipping = ShippingSnapshot.of(address);
        GroupBuyingAuctionParticipation participation =
                participationRepository.save(GroupBuyingAuctionParticipation.builder()
                        .auction(auction)
                        .user(user)
                        .quantity(quantity)
                        .maxUnitPrice(maxUnitPrice)
                        .totalAmount(maxUnitPrice.multiply(BigDecimal.valueOf(quantity)))
                        .status(AuctionParticipationStatus.BID_PLACED)
                        .paymentStatus(PaymentStatus.COMPLETED) // sandbox authorisation of the maximum bid
                        .paymentMethod(request.getPaymentMethod())
                        .paymentReference(CollectiveOrderFactory.paymentReference("auc"))
                        .shippingAddressLine1(shipping.line1())
                        .shippingAddressLine2(shipping.line2())
                        .shippingCity(shipping.city())
                        .shippingState(shipping.state())
                        .shippingPostalCode(shipping.postalCode())
                        .shippingCountry(shipping.country())
                        .bidAt(now)
                        .build());

        auction.setCollectiveQuantity(auction.getCollectiveQuantity() + quantity);
        // Recounted rather than incremented: a customer may hold more than one live bid, and the
        // spec's participant count is a headcount of customers, not of bid rows.
        auction.setParticipantCount(participationRepository.countDistinctActiveBidders(auctionId));
        auctionRepository.save(auction);

        return mapper.toParticipationDto(participationRepository.findById(participation.getId()).orElseThrow());
    }

    @Override
    @Transactional
    public AuctionParticipationDto cancelParticipation(String userEmail, UUID participationId, String reason) {
        User user = requireUser(userEmail);
        GroupBuyingAuctionParticipation participation =
                participationRepository.findByIdAndUserId(participationId, user.getId())
                        .orElseThrow(() -> new ResourceNotFoundException("GroupBuyingAuctionParticipation", "id", participationId));

        if (participation.getStatus() != AuctionParticipationStatus.BID_PLACED) {
            throw bad("This bid can no longer be withdrawn");
        }

        GroupBuyingAuction auction = participation.getAuction();
        // Same lock order placeBid() uses, so a withdrawal can never interleave with finalization.
        auctionRepository.findByIdForUpdate(auction.getId())
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyingAuction", "id", auction.getId()));
        if (!auction.getStatus().acceptsBids()) {
            throw bad("This auction has already ended");
        }

        participation.setStatus(AuctionParticipationStatus.CANCELLED);
        participation.setPaymentStatus(PaymentStatus.REFUNDED);
        participation.setRefundAmount(participation.getTotalAmount());
        participation.setCancelledAt(LocalDateTime.now());
        participation.setCancellationReason(shortText(reasonOrDefault(reason, "Bid withdrawn by the customer"), 500));
        participationRepository.save(participation);

        stockManager.release(auction.getProduct(), auction.getSellerStore(), participation.getQuantity(),
                "AUCTION_WITHDRAW", "AUCTION_PART:" + participation.getId());

        auction.setCollectiveQuantity(Math.max(0, auction.getCollectiveQuantity() - participation.getQuantity()));
        // Recounted, so a customer who still holds another live bid here is still counted.
        auction.setParticipantCount(participationRepository.countDistinctActiveBidders(auction.getId()));
        auctionRepository.save(auction);

        notificationService.sendNotification(SendNotificationRequest.builder()
                .userId(user.getId())
                .title("Auction bid withdrawn")
                .message(shortText("Your " + participation.getQuantity() + " unit(s) were released from '"
                        + shortText(auction.getProduct().getName(), 60) + "' and the full amount refunded.", 1000))
                .type("GROUP_BUYING_AUCTION")
                .link("/group-buying-auctions/my")
                .build());

        return mapper.toParticipationDto(participation);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuctionParticipationDto> getMyParticipations(String userEmail) {
        User user = requireUser(userEmail);
        return participationRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(mapper::toParticipationDto)
                .toList();
    }

    // ----- Helpers -----------------------------------------------------------------------------

    private void validatePaymentMethod(PaymentMethod method) {
        if (method == null || !ONLINE_PAYMENT_METHODS.contains(method)) {
            throw bad("Auction bids require an online payment method (card, PayPal or Stripe)");
        }
    }

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    private static String reasonOrDefault(String reason, String fallback) {
        return reason != null && !reason.isBlank() ? reason.trim() : fallback;
    }

    private static String shortText(String text, int max) {
        if (text == null) {
            return null;
        }
        return text.length() <= max ? text : text.substring(0, max - 1) + "…";
    }

    private static ApiException bad(String message) {
        return new ApiException(message, HttpStatus.BAD_REQUEST);
    }
}
