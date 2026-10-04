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
import com.groupmart.dto.auction.AuctionDto;
import com.groupmart.dto.notification.SendNotificationRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.AuctionClosingService;
import com.groupmart.service.NotificationService;
import com.groupmart.service.ProxyBiddingEngine;
import com.groupmart.realtime.RealtimePublisher;
import com.groupmart.realtime.RealtimeTopics;

/**
 * Settles a closed eBay-style proxy auction.
 * <p>
 * <b>Idempotency.</b> The auction row is locked and checked before anything is written, so the
 * second of two concurrent closes does nothing at all. Three further guards back that up: the
 * terminal status, the {@code unique} constraint on {@code orders.auction_id}, and the fact that
 * only the single top-ranked bid can ever reach the order factory. Running the close repeatedly -
 * the scheduler every 30 seconds, plus the seller pressing "close early" - yields one winner and
 * one order.
 * <p>
 * <b>Price.</b> The winner pays the engine's price - the runner-up's ceiling plus one increment,
 * capped by the winner's own ceiling - never their maximum. A reserve that is not met ends the
 * auction with no sale and no order at all.
 */
@Service
@RequiredArgsConstructor
public class AuctionClosingServiceImpl implements AuctionClosingService {

    private static final String NOTIFICATION_TYPE = "AUCTION";
    private static final String ORDER_NUMBER_TAG = "AUCT";

    private final AuctionRepository auctionRepository;
    private final AuctionBidRepository bidRepository;
    private final UserRepository userRepository;
    private final ReservedStockManager stockManager;
    private final CollectiveOrderFactory orderFactory;
    private final OrderRepository orderRepository;
    private final AuctionMapper mapper;
    private final NotificationService notificationService;
    private final RealtimePublisher realtimePublisher;
    private final ProxyBiddingEngine engine;

    @Override
    @Transactional
    public AuctionDto close(UUID auctionId, String actorEmail, boolean sellerInitiated) {
        Auction auction = auctionRepository.findByIdForUpdate(auctionId)
                .orElseThrow(() -> new ResourceNotFoundException("Auction", "id", auctionId));

        // Already settled: this is the idempotent path the scheduler and the seller button share.
        if (auction.getStatus().isTerminal()) {
            return mapper.toPublicDto(auction);
        }
        if (auction.getStatus() == AuctionStatus.DRAFT) {
            throw bad("A draft auction has never run, so it cannot be closed");
        }

        LocalDateTime now = LocalDateTime.now();
        if (sellerInitiated) {
            requireOwningSeller(auction, actorEmail);
        } else if (auction.getEndsAt().isAfter(now)) {
            throw bad("This auction is still running until " + auction.getEndsAt());
        }

        List<AuctionBid> ranked = bidRepository.findEligibleBidsRanked(auctionId);
        auction.setEndedAt(now);
        auction.setClosedByUserId(actorEmail == null ? null : requireUserId(actorEmail));
        // A seller pulling the auction early is a different outcome from the clock running out, and
        // the close code is what the seller dashboard and the public page both report.
        AuctionCloseCode reachedCode = sellerInitiated
                ? AuctionCloseCode.CLOSED_EARLY_BY_SELLER
                : AuctionCloseCode.DEADLINE_REACHED;

        if (ranked.isEmpty()) {
            closeWithoutSale(auction, sellerInitiated
                            ? AuctionCloseCode.CLOSED_EARLY_BY_SELLER
                            : AuctionCloseCode.DEADLINE_REACHED_NO_BIDS,
                    "This auction closed without a single bid.");
            return mapper.toPublicDto(auction);
        }

        ProxyBiddingEngine.Decision decision = engine.evaluate(auction, toCandidates(ranked), auction.getLeadingBidId());
        AuctionBid winnerBid = ranked.get(0);
        BigDecimal winningMaximum = winnerBid.getMaximumBid();

        // The reserve is judged on what the winner authorised, not on the public price, so a seller
        // can hold a floor without ever disclosing it.
        if (auction.hasReserve() && winningMaximum.compareTo(auction.getReservePrice()) < 0) {
            closeWithoutSale(auction, AuctionCloseCode.RESERVE_NOT_MET,
                    "This auction closed with its reserve price unmet.");
            markBidsLost(ranked);
            notifyBidders(auction, ranked, null, null);
            return mapper.toPublicDto(auction);
        }

        settleSold(auction, winnerBid, decision.price(), ranked, reachedCode);
        return mapper.toPublicDto(auction);
    }

    @Override
    @Transactional
    public AuctionDto cancelByAdmin(UUID auctionId, String adminEmail, String reason) {
        Auction auction = auctionRepository.findByIdForUpdate(auctionId)
                .orElseThrow(() -> new ResourceNotFoundException("Auction", "id", auctionId));
        if (auction.getStatus().isTerminal()) {
            return mapper.toPublicDto(auction);
        }
        if (userRepository.findByEmail(adminEmail)
                .map(user -> user.getRole() != Role.ROLE_ADMIN)
                .orElse(true)) {
            throw new ApiException("Only an administrator can cancel somebody else's auction",
                    HttpStatus.FORBIDDEN);
        }

        String note = reason != null && !reason.isBlank()
                ? shortText(reason, 500)
                : "Cancelled by an administrator";
        auction.setStatus(AuctionStatus.CANCELLED);
        auction.setCloseCode(AuctionCloseCode.CANCELLED_BY_ADMIN);
        auction.setCloseNote(note);
        auction.setEndedAt(LocalDateTime.now());
        auction.setClosedByUserId(requireUserId(adminEmail));

        if (auction.isInventoryReserved()) {
            stockManager.release(auction.getProduct(), auction.getSellerStore(), auction.getQuantity(),
                    "AUCTION_CANCELLED", "AUCTION:" + auction.getId());
            auction.setInventoryReserved(false);
        }
        List<AuctionBid> bids = bidRepository.findByAuctionIdOrderByPlacedAtAsc(auctionId);
        markBidsLost(bids);
        auctionRepository.save(auction);
        notifyBidders(auction, bids, null, note);
        notify(auction.getSellerStore().getUser(), "Auction cancelled by an admin",
                "'" + shortText(auction.getProduct().getName(), 60) + "' was cancelled: " + note,
                "/seller/dashboard?tab=auctions");

        return mapper.toPublicDto(auction);
    }

    // ----- Outcome paths ----------------------------------------------------------------------

    /** Closes with no sale: the lot goes back on sale and nobody gets an order. */
    private void closeWithoutSale(Auction auction, AuctionCloseCode code, String note) {
        auction.setStatus(code == AuctionCloseCode.RESERVE_NOT_MET
                ? AuctionStatus.RESERVE_NOT_MET
                : AuctionStatus.ENDED);
        auction.setCloseCode(code);
        auction.setCloseNote(note);
        auction.setLeadingBidId(null);
        auction.setLeadingBidder(null);

        if (auction.isInventoryReserved()) {
            stockManager.release(auction.getProduct(), auction.getSellerStore(), auction.getQuantity(),
                    "AUCTION_RELEASE", "AUCTION:" + auction.getId());
            auction.setInventoryReserved(false);
        }
        auctionRepository.save(auction);
        notify(auction.getSellerStore().getUser(), "Auction closed without a sale",
                "'" + shortText(auction.getProduct().getName(), 60) + "': " + note
                        + " The stock is back on sale.",
                "/seller/dashboard?tab=auctions");
    }

    /** Closes with a sale: the winner's bid becomes an order at the engine's price. */
    private void settleSold(Auction auction, AuctionBid winnerBid, BigDecimal finalPrice, List<AuctionBid> ranked,
                            AuctionCloseCode reachedCode) {
        BigDecimal payable = finalPrice.multiply(BigDecimal.valueOf(winnerBid.getQuantity()));

        Order order = orderFactory.createIndividualOrder(
                ORDER_NUMBER_TAG,
                OrderType.AUCTION,
                auction.getProduct(),
                auction.getSellerStore(),
                winnerBid.getBidder(),
                winnerBid.getQuantity(),
                finalPrice,
                new ShippingSnapshot(
                        winnerBid.getShippingAddressLine1(),
                        winnerBid.getShippingAddressLine2(),
                        winnerBid.getShippingCity(),
                        winnerBid.getShippingState(),
                        winnerBid.getShippingPostalCode(),
                        winnerBid.getShippingCountry()),
                winnerBid.getPaymentMethod(),
                winnerBid.getPaymentReference(),
                "Auction " + auction.getId() + " won at " + finalPrice + " per unit");

        // The unique auction_id is the last line of defence: if a second close ever slipped past the
        // lock and the status check, this save fails instead of creating a second winner's order.
        order.setAuctionId(auction.getId());
        orderRepository.save(order);

        auction.setStatus(AuctionStatus.SOLD);
        auction.setCloseCode(reachedCode);
        auction.setCloseNote("Sold to the highest bidder");
        auction.setFinalPrice(finalPrice);
        auction.setWinner(winnerBid.getBidder());
        auction.setWinningBidId(winnerBid.getId());
        auction.setWinnerOrderId(order.getId());
        auction.setLeadingBidder(winnerBid.getBidder());
        auction.setLeadingBidId(winnerBid.getId());
        // The lot was taken out of stock when the auction was created and is now genuinely sold.
        auction.setInventoryReserved(false);

        auctionRepository.save(auction);

        winnerBid.setStatus(AuctionBidStatus.WON);
        winnerBid.setAmountPaid(payable);
        winnerBid.setOrderId(order.getId());
        winnerBid.setPaymentStatus(PaymentStatus.COMPLETED);
        bidRepository.save(winnerBid);

        for (AuctionBid loser : ranked) {
            if (!loser.getId().equals(winnerBid.getId())) {
                loser.setStatus(AuctionBidStatus.LOST);
                bidRepository.save(loser);
            }
        }

        notifyBidders(auction, ranked, winnerBid, null);
        notify(winnerBid.getBidder(), "You won the auction",
                "You won '" + shortText(auction.getProduct().getName(), 60) + "' at " + finalPrice
                        + " per unit. Order " + order.getOrderNumber() + " is ready.",
                "/orders/confirmation/" + order.getOrderNumber());
        notify(auction.getSellerStore().getUser(), "Your auction sold",
                "'" + shortText(auction.getProduct().getName(), 60) + "' sold at " + finalPrice
                        + " per unit. Order " + order.getOrderNumber() + " was created.",
                "/seller/dashboard?tab=auctions");

        announceAuctionSettled(auction, winnerBid, ranked, order);
    }

    /**
     * Tells the browsers that can see this auction that it is over.
     * <p>
     * The winner is told twice over, on purpose: once on the auction topic so the bidding page
     * stops showing them as leading, and once on the orders topic because they now have an order
     * that did not exist a moment ago and their order list is stale.
     */
    private void announceAuctionSettled(Auction auction, AuctionBid winnerBid,
                                        List<AuctionBid> ranked, Order order) {
        String winnerEmail = winnerBid.getBidder().getEmail();
        String summary = "Auction closed at " + auction.getFinalPrice() + " per unit";

        realtimePublisher.userChanged(RealtimeTopics.AUCTION, "auction", auction.getId(),
                winnerEmail, summary);
        realtimePublisher.userChanged(RealtimeTopics.ORDERS, "order", order.getId(),
                winnerEmail, "You won an auction - order " + order.getOrderNumber() + " is ready");

        // Everybody else who bid needs to see their own bid marked lost, so each of them is told
        // individually rather than being left to notice on a page refresh.
        for (AuctionBid bid : ranked) {
            if (!bid.getId().equals(winnerBid.getId())) {
                realtimePublisher.userChanged(RealtimeTopics.AUCTION, "auction", auction.getId(),
                        bid.getBidder().getEmail(), summary);
            }
        }
        // The seller watches this auction too.
        realtimePublisher.userChanged(RealtimeTopics.SELLER_ACCOUNT, "auction", auction.getId(),
                auction.getSellerStore().getUser().getEmail(), "One of your auctions sold");
    }

    private void markBidsLost(List<AuctionBid> bids) {
        for (AuctionBid bid : bids) {
            if (bid.isEligible()) {
                bid.setStatus(AuctionBidStatus.LOST);
                bidRepository.save(bid);
            }
        }
    }

    /** Tells every bidder the outcome. The winner's ceiling is never quoted to the losers. */
    private void notifyBidders(Auction auction, List<AuctionBid> bids, AuctionBid winner, String adminNote) {
        for (AuctionBid bid : bids) {
            boolean won = winner != null && winner.getId().equals(bid.getId());
            if (won) {
                continue;
            }
            String message = adminNote != null
                    ? "Auction: " + shortText(auction.getProduct().getName(), 60) + " was cancelled. " + adminNote
                    : "Auction: " + shortText(auction.getProduct().getName(), 60)
                        + " closed at " + auction.getCurrentPrice() + " without a sale.";
            notify(bid.getBidder(), "Auction closed", message, "/auctions/" + auction.getId());
        }
    }

    // ----- Helpers ----------------------------------------------------------------------------

    private List<ProxyBiddingEngine.Candidate> toCandidates(List<AuctionBid> bids) {
        return bids.stream()
                .map(bid -> new ProxyBiddingEngine.Candidate(
                        bid.getId(), bid.getBidder().getId(), bid.getMaximumBid(), bid.getQuantity(), bid.getPlacedAt()))
                .toList();
    }

    private void requireOwningSeller(Auction auction, String actorEmail) {
        if (actorEmail == null) {
            throw new ApiException("Only the owning seller can close an auction early", HttpStatus.FORBIDDEN);
        }
        UUID actorId = requireUserId(actorEmail);
        boolean isAdmin = userRepository.findByEmail(actorEmail)
                .map(user -> user.getRole() == Role.ROLE_ADMIN)
                .orElse(false);
        if (isAdmin) {
            return;
        }
        if (auction.getSellerStore() == null || auction.getSellerStore().getUser() == null
                || !auction.getSellerStore().getUser().getId().equals(actorId)) {
            throw new ApiException("You can only close your own auctions", HttpStatus.FORBIDDEN);
        }
    }

    private UUID requireUserId(String email) {
        return userRepository.findByEmail(email)
                .map(User::getId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    private void notify(User recipient, String title, String message, String link) {
        if (recipient == null) {
            return;
        }
        notificationService.sendNotification(SendNotificationRequest.builder()
                .userId(recipient.getId())
                .title(shortText(title, 150))
                .message(shortText(message, 1000))
                .type(NOTIFICATION_TYPE)
                .link(link)
                .build());
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
