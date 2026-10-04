package com.groupmart.service.impl;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.auction.GroupBuyingAuctionDto;
import com.groupmart.dto.notification.SendNotificationRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.AuctionFinalizationService;
import com.groupmart.service.AuctionPricingService;
import com.groupmart.service.NotificationService;

import static com.groupmart.service.impl.GroupBuyEventRecorder.money;

/**
 * The authoritative end of a Group Buying Auction.
 * <p>
 * The backend, not the frontend, decides when an auction is over and what it settled at:
 * <ol>
 *   <li>The auction row is locked, so a seller pressing "finalize" cannot race the deadline sweep.</li>
 *   <li>Anything already terminal is a no-op - an auction can never be finalized twice.</li>
 *   <li>If the collective quantity never reached the seller's minimum, the auction FAILS and every
 *       bid is refunded and its quantity released.</li>
 *   <li>Otherwise {@link AuctionPricingService} computes the clearing price from the auction's own
 *       configured rule. That price is written once to the immutable result and to the auction.</li>
 *   <li>Bids at or above the clearing price become individual orders priced at it; bids below it are
 *       OUTBID, refunded and their units released.</li>
 * </ol>
 * Nothing here reads or reuses a CWP wholesale price, pool or reservation.
 */
@Service
@RequiredArgsConstructor
public class AuctionFinalizationServiceImpl implements AuctionFinalizationService {

    private static final String SELLER_LINK = "/seller/dashboard?tab=group-buying-auctions";
    private static final String CUSTOMER_LINK = "/orders";

    private final GroupBuyingAuctionRepository auctionRepository;
    private final GroupBuyingAuctionParticipationRepository participationRepository;
    private final GroupBuyingAuctionResultRepository resultRepository;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final ReservedStockManager stockManager;
    private final CollectiveOrderFactory orderFactory;
    private final AuctionPricingService pricingService;
    private final NotificationService notificationService;
    private final GroupBuyingAuctionMapper mapper;

    @Override
    @Transactional
    public GroupBuyingAuctionDto finalizeAuction(UUID auctionId, String actorEmail, boolean sellerInitiated) {
        GroupBuyingAuction auction = auctionRepository.findByIdForUpdate(auctionId)
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyingAuction", "id", auctionId));

        if (auction.getStatus().isTerminal() || resultRepository.existsByAuctionId(auctionId)) {
            return mapper.toAuctionDto(auction); // already finalized: a safe no-op
        }
        if (auction.getStatus() == GroupBuyingAuctionStatus.DRAFT
                || auction.getStatus() == GroupBuyingAuctionStatus.SCHEDULED) {
            throw new ApiException("This auction has not started, so it cannot be finalized",
                    HttpStatus.BAD_REQUEST);
        }
        if (!sellerInitiated && auction.getEndsAt().isAfter(LocalDateTime.now())) {
            throw new ApiException("This auction has not reached its end time yet", HttpStatus.BAD_REQUEST);
        }

        LocalDateTime now = LocalDateTime.now();
        List<GroupBuyingAuctionParticipation> openBids = participationRepository
                .findByAuctionIdAndStatus(auctionId, AuctionParticipationStatus.BID_PLACED);

        if (auction.getCollectiveQuantity() < auction.getMinimumCollectiveQuantity()) {
            return failAuction(auction, openBids, actorEmail, now);
        }

        // The single clearing price, derived only from the auction's own configured rule.
        BigDecimal finalUnitPrice = pricingService.calculateUnitPrice(auction, auction.getCollectiveQuantity());

        auction.setFinalUnitPrice(finalUnitPrice);
        auction.setFinalizedAt(now);
        auction.setStatus(GroupBuyingAuctionStatus.COMPLETED);
        auction.setCloseCode(sellerInitiated ? GroupBuyingAuctionCloseCode.CLOSED_EARLY_BY_SELLER
                : GroupBuyingAuctionCloseCode.DEADLINE_REACHED);
        auctionRepository.saveAndFlush(auction);

        User finalizedBy = actorEmail == null ? null
                : userRepository.findByEmail(actorEmail).orElse(null);
        GroupBuyingAuctionResult result = resultRepository.save(GroupBuyingAuctionResult.builder()
                .auction(auction)
                .pricingRule(auction.getPricingRule())
                .finalUnitPrice(finalUnitPrice)
                .startingPriceAtFinalization(auction.getStartingPrice())
                .collectiveQuantity(auction.getCollectiveQuantity())
                .bidderCount(auction.getParticipantCount())
                .winningBidCount(0)
                .outbidCount(0)
                .minimumSellerUnitPrice(auction.getMinimumSellerUnitPrice())
                .finalizedAt(now)
                .finalizedBy(finalizedBy)
                .build());

        int winners = 0;
        int outbid = 0;
        int winningQuantity = 0;
        int outbidQuantity = 0;
        BigDecimal totalSuccessfulSales = BigDecimal.ZERO;
        String productName = shortText(auction.getProduct().getName(), 60);
        for (GroupBuyingAuctionParticipation bid : openBids) {
            if (bid.getMaxUnitPrice().compareTo(finalUnitPrice) >= 0) {
                Order order = orderFactory.createIndividualOrder(
                        "AUC", OrderType.GROUP_BUYING_AUCTION, auction.getProduct(), auction.getSellerStore(),
                        bid.getUser(), bid.getQuantity(), finalUnitPrice,
                        new ShippingSnapshot(bid.getShippingAddressLine1(), bid.getShippingAddressLine2(),
                                bid.getShippingCity(), bid.getShippingState(), bid.getShippingPostalCode(),
                                bid.getShippingCountry()),
                        bid.getPaymentMethod(), bid.getPaymentReference(),
                        "SANDBOX_AUCTION_CAPTURE: clearing price " + finalUnitPrice + " settled at " + now);

                order.setGroupBuyingAuctionId(auction.getId());
                orderRepository.save(order);

                // The order is priced at the one clearing price, never at the bidder's own ceiling.
                BigDecimal lineTotal = finalUnitPrice.multiply(BigDecimal.valueOf(bid.getQuantity()));
                bid.setOrder(order);
                bid.setStatus(AuctionParticipationStatus.WON);
                bid.setTotalAmount(lineTotal);
                participationRepository.save(bid);
                winners++;
                winningQuantity += bid.getQuantity();
                totalSuccessfulSales = totalSuccessfulSales.add(lineTotal);

                notify(bid.getUser(), "Your auction bid won",
                        "The auction for '" + productName + "' settled at " + money(finalUnitPrice) + " per unit. Order "
                                + order.getOrderNumber() + " was created for your " + bid.getQuantity() + " unit(s).",
                        CUSTOMER_LINK);
            } else {
                // The collective price landed above what this customer was willing to pay.
                outbidRefund(auction, bid, finalUnitPrice, productName);
                outbid++;
                outbidQuantity += bid.getQuantity();
            }
        }

        result.setWinningBidCount(winners);
        result.setOutbidCount(outbid);
        // Sold units are the winners' units only. The outbid quantities already contributed to the
        // collective total that set this price and stay counted in it, but they are not sales.
        result.setWinningQuantity(winningQuantity);
        result.setOutbidQuantity(outbidQuantity);
        result.setTotalSuccessfulSales(totalSuccessfulSales);
        resultRepository.save(result);

        notifySeller(auction, "Group buying auction finalized",
                "The auction for '" + productName + "' settled at " + money(finalUnitPrice) + " per unit on "
                        + auction.getCollectiveQuantity() + " collectively bid unit(s): " + winners + " order(s) created, "
                        + outbid + " bid(s) outbid and refunded.");

        return mapper.toAuctionDto(auction);
    }

    /** Below the minimum collective quantity: no result, no orders, every bid refunded. */
    private GroupBuyingAuctionDto failAuction(GroupBuyingAuction auction,
                                              List<GroupBuyingAuctionParticipation> openBids,
                                              String actorEmail, LocalDateTime now) {
        String productName = shortText(auction.getProduct().getName(), 60);
        for (GroupBuyingAuctionParticipation bid : openBids) {
            outbidRefund(auction, bid, null, productName);
        }
        auction.setStatus(GroupBuyingAuctionStatus.FAILED);
        auction.setFinalizedAt(now);
        auction.setCloseCode(GroupBuyingAuctionCloseCode.DEADLINE_REACHED_BELOW_MINIMUM);
        auction.setFinalUnitPrice(null); // no price was ever locked, so nothing can be charged for it
        auctionRepository.save(auction);

        notifySeller(auction, "Group buying auction failed",
                "The auction for '" + productName + "' ended with " + auction.getCollectiveQuantity() + " of "
                        + auction.getMinimumCollectiveQuantity() + " required units. Every bid was refunded and "
                        + openBids.size() + " unit reservation(s) released.");
        return mapper.toAuctionDto(auction);
    }

    private void outbidRefund(GroupBuyingAuction auction, GroupBuyingAuctionParticipation bid,
                              BigDecimal clearingPrice, String productName) {
        bid.setStatus(clearingPrice == null ? AuctionParticipationStatus.REFUNDED : AuctionParticipationStatus.OUTBID);
        bid.setPaymentStatus(PaymentStatus.REFUNDED);
        bid.setRefundAmount(bid.getTotalAmount());
        bid.setCancelledAt(LocalDateTime.now());
        bid.setCancellationReason(clearingPrice == null
                ? GroupBuyingAuctionCloseCode.DEADLINE_REACHED_BELOW_MINIMUM.getLabel()
                : "The auction settled at " + clearingPrice + " per unit, above your maximum bid of "
                        + bid.getMaxUnitPrice());
        participationRepository.save(bid);

        // These units were reserved when the bid was placed and never sold.
        stockManager.release(auction.getProduct(), auction.getSellerStore(), bid.getQuantity(),
                "AUCTION_RELEASE", "AUCTION_PART:" + bid.getId());

        notify(bid.getUser(),
                clearingPrice == null ? "Auction ended without its minimum" : "Your auction bid was outbid",
                clearingPrice == null
                        ? "The auction for '" + productName + "' did not reach its minimum collective quantity. "
                                + money(bid.getTotalAmount()) + " was refunded and your units released."
                        : "The auction for '" + productName + "' settled at " + clearingPrice + " per unit, above your "
                                + "maximum bid. " + money(bid.getTotalAmount()) + " was refunded and your units released.",
                clearingPrice == null ? "/group-buying-auctions/my" : "/group-buying-auctions/" + auction.getId());
    }

    private void notifySeller(GroupBuyingAuction auction, String title, String message) {
        notify(auction.getSellerStore().getUser(), title, message, SELLER_LINK);
    }

    private void notify(User recipient, String title, String message, String link) {
        if (recipient == null) {
            return;
        }
        notificationService.sendNotification(SendNotificationRequest.builder()
                .userId(recipient.getId())
                .title(shortText(title, 150))
                .message(shortText(message, 1000))
                .type("GROUP_BUYING_AUCTION")
                .link(link)
                .build());
    }

    private static String shortText(String text, int max) {
        if (text == null) {
            return null;
        }
        return text.length() <= max ? text : text.substring(0, max - 1) + "…";
    }
}
