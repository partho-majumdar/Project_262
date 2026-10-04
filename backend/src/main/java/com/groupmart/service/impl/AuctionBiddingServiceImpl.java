package com.groupmart.service.impl;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.auction.BidHistoryEntryDto;
import com.groupmart.dto.auction.MyAuctionBidDto;
import com.groupmart.dto.auction.MyBidViewDto;
import com.groupmart.dto.auction.PlaceAuctionBidRequest;
import com.groupmart.dto.auction.SellerAuctionBidDto;
import com.groupmart.dto.notification.SendNotificationRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.AuctionBiddingService;
import com.groupmart.service.NotificationService;
import com.groupmart.service.ProxyBiddingEngine;

/**
 * Customer bidding in an eBay-style proxy auction.
 * <p>
 * The customer supplies a private ceiling and nothing else. This service is the only place that
 * writes {@code currentPrice} or names a leader, and it always does so by delegating to
 * {@link ProxyBiddingEngine} after re-reading every eligible bid.
 * <p>
 * Concurrency: the auction row is taken with {@code PESSIMISTIC_WRITE} for the whole operation, so
 * two simultaneous bids cannot both read the same leader and both believe they won. Nothing about
 * the outcome is decided from a value the client sent.
 * <p>
 * Independent of {@link AuctionParticipationService}, which clears one collective price for a group
 * instead of competing private maxima.
 */
@Service
@RequiredArgsConstructor
public class AuctionBiddingServiceImpl implements AuctionBiddingService {

    private static final Set<PaymentMethod> ONLINE_PAYMENT_METHODS = EnumSet.of(
            PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD, PaymentMethod.PAYPAL, PaymentMethod.STRIPE);
    private static final String NOTIFICATION_TYPE = "AUCTION";

    private final AuctionRepository auctionRepository;
    private final AuctionBidRepository bidRepository;
    private final UserRepository userRepository;
    private final AddressRepository addressRepository;
    private final SellerStoreRepository sellerStoreRepository;
    private final ProxyBiddingEngine engine;
    private final AuctionMapper mapper;
    private final NotificationService notificationService;

    @Override
    @Transactional
    public MyAuctionBidDto placeBid(String bidderEmail, UUID auctionId, PlaceAuctionBidRequest request) {
        User bidder = requireUser(bidderEmail);
        if (!bidder.isEnabled()) {
            throw new ApiException("This account cannot place bids", HttpStatus.FORBIDDEN);
        }

        // The lock is the whole concurrency story: it serialises every bid on this auction.
        Auction auction = auctionRepository.findByIdForUpdate(auctionId)
                .orElseThrow(() -> new ResourceNotFoundException("Auction", "id", auctionId));

        LocalDateTime now = LocalDateTime.now();
        if (!auction.getStatus().acceptsBids()) {
            throw bad("This auction is not open for bidding");
        }
        if (now.isBefore(auction.getStartsAt())) {
            throw bad("This auction has not started yet");
        }
        if (!auction.getEndsAt().isAfter(now)) {
            // The server clock decides this, never the browser's.
            throw bad("This auction has ended and is awaiting its result");
        }
        if (isSeller(bidder, auction)) {
            throw new ApiException("You cannot bid on your own auction", HttpStatus.FORBIDDEN);
        }

        int quantity = request.getQuantity() == null ? auction.getQuantity() : request.getQuantity();
        if (quantity < 1 || quantity > auction.getQuantity()) {
            throw bad("A bid must be for between 1 and " + auction.getQuantity() + " unit(s)");
        }
        validatePaymentMethod(request.getPaymentMethod());

        Address address = addressRepository.findByIdAndUserId(request.getAddressId(), bidder.getId())
                .orElseThrow(() -> bad("Select a valid shipping address from your address book"));
        ShippingSnapshot shipping = ShippingSnapshot.of(address);

        BigDecimal maximumBid = request.getMaximumBid();
        // The server computes the threshold; the client is never asked what it is.
        engine.requireMaximumAtLeast(auction, maximumBid);

        Optional<AuctionBid> existing = bidRepository.findByAuctionAndBidder(auctionId, bidder.getId());
        AuctionBid bid;
        if (existing.isPresent()) {
            bid = existing.get();
            if (!bid.isEligible()) {
                throw bad("Your bid on this auction can no longer be changed");
            }
            if (maximumBid.compareTo(bid.getMaximumBid()) <= 0) {
                // Raising a ceiling is the only useful change; anything else is a duplicate bid.
                throw bad("Your new maximum must be higher than the " + bid.getMaximumBid()
                        + " you already authorised on this auction");
            }
            // placedAt is the tie-break, so it is deliberately not moved when a ceiling is raised.
            bid.setMaximumBid(maximumBid);
            // Recorded explicitly: a raise is a customer action, which updatedAt cannot express
            // because re-pricing the auction also touches every bid row.
            bid.setCeilingRaisedAt(now);
        } else {            bid = AuctionBid.builder()
                    .auction(auction)
                    .bidder(bidder)
                    .maximumBid(maximumBid)
                    // Provisional: the engine below replaces this with the amount actually committed.
                    .effectiveBid(auction.getCurrentPrice())
                    .quantity(quantity)
                    .status(AuctionBidStatus.ACTIVE)
                    .paymentStatus(PaymentStatus.COMPLETED) // sandbox authorisation of the ceiling
                    .paymentMethod(request.getPaymentMethod())
                    .paymentReference(CollectiveOrderFactory.paymentReference("auction"))
                    .shippingAddressLine1(shipping.line1())
                    .shippingAddressLine2(shipping.line2())
                    .shippingCity(shipping.city())
                    .shippingState(shipping.state())
                    .shippingPostalCode(shipping.postalCode())
                    .shippingCountry(shipping.country())
                    .placedAt(now)
                    .build();
        }
        bid.setQuantity(quantity);
        bid.setPaymentMethod(request.getPaymentMethod());
        applyShippingSnapshot(bid, shipping);
        bidRepository.save(bid);

        // Recompute the public price from the whole set of ceilings, not by patching the old one.
        List<AuctionBid> eligible = bidRepository.findEligibleBidsRanked(auctionId);
        UUID previousLeaderBidId = auction.getLeadingBidId();
        List<ProxyBiddingEngine.Candidate> candidates = toCandidates(eligible);
        ProxyBiddingEngine.Decision decision = engine.evaluate(auction, candidates, previousLeaderBidId);

        auction.setCurrentPrice(decision.price());
        auction.setLeadingBidId(decision.leader() != null ? decision.leader().bidId() : null);
        auction.setLeadingBidder(decision.leader() != null
                ? findBidder(decision.leader().bidId(), eligible)
                : null);
        if (auction.getBidCount() == 0) {
            auction.setBidCount(1);
        } else if (existing.isEmpty()) {
            auction.setBidCount(auction.getBidCount() + 1);
        }
        auction.setBidderCount((int) bidRepository.countDistinctBidders(auctionId));
        auctionRepository.save(auction);

        // Reflect the new ranking on every bid so the statuses and committed amounts always match
        // the engine. Only the previous leader becoming a loser is news worth an outbid notice.
        boolean isNewLeader = decision.leader() != null
                && decision.leader().bidId().equals(bid.getId());
        List<AuctionBid> newlyOutbid = new ArrayList<>();
        for (AuctionBid candidate : eligible) {
            boolean leading = decision.leader() != null
                    && decision.leader().bidId().equals(candidate.getId());
            if (!leading && previousLeaderBidId != null && previousLeaderBidId.equals(candidate.getId())) {
                newlyOutbid.add(candidate);
            }
            candidate.setStatus(leading ? AuctionBidStatus.WINNING : AuctionBidStatus.OUTBID);
            // The leader is committed to the public price. A bidder who is not leading is committed
            // to no more than their own ceiling, because the amount that would take the lead is by
            // definition more than they authorised. Reporting that higher figure made the public
            // ladder show losing bids above the leader and told customers they owed more than they
            // ever agreed to.
            candidate.setEffectiveBid(engine.committedAmountFor(auction, candidates, candidate.getId()));
            bidRepository.save(candidate);
        }

        notifyOutbid(newlyOutbid, auction);
        notifyLeader(auction, decision, isNewLeader);

        AuctionBid placed = bidRepository.findById(bid.getId()).orElseThrow();
        return mapper.toMyBidDto(placed, auction,
                engine.committedAmountFor(auction, candidates, placed.getId()));
    }

    @Override
    @Transactional
    public MyAuctionBidDto withdrawBid(String bidderEmail, UUID bidId, String reason) {
        User bidder = requireUser(bidderEmail);
        AuctionBid bid = bidRepository.findByIdAndBidderId(bidId, bidder.getId())
                .orElseThrow(() -> new ResourceNotFoundException("AuctionBid", "id", bidId));
        UUID auctionId = bid.getAuction().getId();

        Auction auction = auctionRepository.findByIdForUpdate(auctionId)
                .orElseThrow(() -> new ResourceNotFoundException("Auction", "id", auctionId));
        if (!auction.acceptsBidsAt(LocalDateTime.now())) {
            throw bad("This auction is closed, so a bid can no longer be withdrawn");
        }
        if (!bid.isEligible()) {
            throw bad("This bid can no longer be withdrawn");
        }

        bid.setStatus(AuctionBidStatus.CANCELLED);
        bid.setCancelledAt(LocalDateTime.now());
        bid.setCancellationReason(shortText(
                reason != null && !reason.isBlank() ? reason.trim() : "Withdrawn by the customer", 500));
        bidRepository.save(bid);

        // Re-price without the withdrawn ceiling, so the next bidder in line takes the lead.
        List<AuctionBid> remaining = bidRepository.findEligibleBidsRanked(auctionId);
        List<ProxyBiddingEngine.Candidate> remainingCandidates = toCandidates(remaining);
        ProxyBiddingEngine.Decision decision =
                engine.evaluate(auction, remainingCandidates, auction.getLeadingBidId());
        auction.setCurrentPrice(decision.price());
        auction.setLeadingBidId(decision.leader() != null ? decision.leader().bidId() : null);
        auction.setLeadingBidder(decision.leader() != null ? findBidder(decision.leader().bidId(), remaining) : null);
        auction.setBidderCount((int) bidRepository.countDistinctBidders(auctionId));
        auctionRepository.save(auction);

        for (AuctionBid candidate : remaining) {
            boolean leading = decision.leader() != null
                    && decision.leader().bidId().equals(candidate.getId());
            candidate.setStatus(leading ? AuctionBidStatus.WINNING : AuctionBidStatus.OUTBID);
            // Same rule as on placement: a bidder who is not leading is never committed to more
            // than their own ceiling.
            candidate.setEffectiveBid(
                    engine.committedAmountFor(auction, remainingCandidates, candidate.getId()));
            bidRepository.save(candidate);
        }

        notify(bidder, "Bid withdrawn",
                "Your bid on '" + shortText(auction.getProduct().getName(), 60) + "' was withdrawn.",
                "/auctions/my-bids");
        if (decision.hasLeader()) {
            notify(findBidder(decision.leader().bidId(), remaining), "You are winning again",
                    "You lead '" + shortText(auction.getProduct().getName(), 60) + "' at "
                            + decision.price() + ".",
                    "/auctions/" + auctionId);
        }

        return mapper.toMyBidDto(bid, auction);
    }

    @Override
    @Transactional(readOnly = true)
    public MyAuctionBidDto getMyBid(String bidderEmail, UUID auctionId) {
        User bidder = requireUser(bidderEmail);
        Auction auction = auctionRepository.findById(auctionId)
                .orElseThrow(() -> new ResourceNotFoundException("Auction", "id", auctionId));
        AuctionBid bid = bidRepository.findByAuctionAndBidder(auctionId, bidder.getId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "You have not bid on this auction", "auctionId", auctionId));
        return mapper.toMyBidDto(bid, auction, committedAmountOf(bid, auction));
    }

    /**
     * What one bid is committed to right now, derived from the live ranking.
     * <p>
     * Read from the stored column this would report a superseded figure to the bidder whose own
     * page was most likely to be wrong, since a stale row is exactly what a customer would notice.
     * A bid that is no longer eligible keeps its recorded figure, because that amount really was
     * committed to it when it was settled.
     */
    private BigDecimal committedAmountOf(AuctionBid bid, Auction auction) {
        if (!bid.isEligible()) {
            return bid.getEffectiveBid();
        }
        return engine.committedAmountFor(auction,
                toCandidates(bidRepository.findEligibleBidsRanked(auction.getId())), bid.getId());
    }

    @Override
    @Transactional(readOnly = true)
    public List<BidHistoryEntryDto> getBidHistory(UUID auctionId) {
        if (!auctionRepository.existsById(auctionId)) {
            throw new ResourceNotFoundException("Auction", "id", auctionId);
        }
        Auction auction = auctionRepository.findById(auctionId).orElseThrow();
        return historyOf(auction);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MyBidViewDto> getMyBids(String bidderEmail) {
        User bidder = requireUser(bidderEmail);
        return bidRepository.findByBidderIdOrderByCreatedAtDesc(bidder.getId()).stream()
                .map(bid -> mapper.toMyBidView(bid, bid.getAuction(), committedAmountOf(bid, bid.getAuction())))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<BidHistoryEntryDto> getBidHistoryForSeller(String sellerEmail, UUID auctionId) {
        User seller = requireUser(sellerEmail);
        Auction auction = auctionRepository.findById(auctionId)
                .orElseThrow(() -> new ResourceNotFoundException("Auction", "id", auctionId));
        if (seller.getRole() != Role.ROLE_ADMIN
                && (auction.getSellerStore() == null
                    || !auction.getSellerStore().getId().equals(
                            sellerStoreRepository.findByUserId(seller.getId()).map(SellerStore::getId).orElse(null)))) {
            throw new ApiException("You can only see bids on your own auctions", HttpStatus.FORBIDDEN);
        }
        return historyOf(auction);
    }

    /**
     * The seller's own bid list: who bid, what each bid is committed to, the ceiling behind it and
     * where it currently stands.
     * <p>
     * The public ladder is deliberately anonymous, which left a seller unable to answer the two
     * questions that matter while an auction runs: who is ahead, and what did the price just move
     * to. This is the privileged view of the same rows, behind the same ownership check, ordered so
     * the leading bid is first.
     */
    @Override
    @Transactional(readOnly = true)
    public List<SellerAuctionBidDto> getSellerBids(String sellerEmail, UUID auctionId) {
        User seller = requireUser(sellerEmail);
        Auction auction = auctionRepository.findById(auctionId)
                .orElseThrow(() -> new ResourceNotFoundException("Auction", "id", auctionId));
        if (seller.getRole() != Role.ROLE_ADMIN
                && (auction.getSellerStore() == null
                    || !auction.getSellerStore().getId().equals(
                            sellerStoreRepository.findByUserId(seller.getId()).map(SellerStore::getId).orElse(null)))) {
            throw new ApiException("You can only see bids on your own auctions", HttpStatus.FORBIDDEN);
        }
        // Includes cancelled bids: a seller needs to see that a bidder withdrew, and the public
        // history hides that row entirely.
        List<AuctionBid> all = bidRepository.findByAuctionIdOrderByPlacedAtAsc(auctionId);
        List<ProxyBiddingEngine.Candidate> candidates =
                toCandidates(bidRepository.findEligibleBidsRanked(auctionId));
        return mapper.toSellerBids(auction, all, candidates, engine);
    }

    // ----- Helpers ----------------------------------------------------------------------------

    /**
     * The public ladder, recomputed from the bids that are eligible right now.
     * <p>
     * The committed amounts are derived from the live bid set rather than read back from the stored
     * {@code effective_bid} column. A stored figure goes stale the moment the ranking changes, and
     * rows written before this rule existed would keep reporting a superseded amount forever - which
     * is exactly what put two losing bids above the leader on the public page. Deriving every read
     * makes the ladder correct by construction, whatever happened to be persisted.
     * <p>
     * Newest first, and a withdrawn bid disappears from the public history.
     */
    private List<BidHistoryEntryDto> historyOf(Auction auction) {
        List<AuctionBid> eligible = bidRepository.findEligibleBidsRanked(auction.getId());
        List<ProxyBiddingEngine.Candidate> candidates = toCandidates(eligible);

        List<AuctionBid> visible = new ArrayList<>(eligible);
        java.util.Collections.reverse(visible);
        return mapper.toBidHistory(auction, visible, candidates, engine);
    }

    private List<ProxyBiddingEngine.Candidate> toCandidates(List<AuctionBid> bids) {
        return bids.stream()
                .map(bid -> new ProxyBiddingEngine.Candidate(
                        bid.getId(), bid.getBidder().getId(), bid.getMaximumBid(), bid.getQuantity(), bid.getPlacedAt()))
                .toList();
    }

    private User findBidder(UUID bidId, List<AuctionBid> bids) {
        if (bidId == null) {
            return null;
        }
        return bids.stream()
                .filter(bid -> bidId.equals(bid.getId()))
                .map(AuctionBid::getBidder)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    private static void applyShippingSnapshot(AuctionBid bid, ShippingSnapshot shipping) {
        bid.setShippingAddressLine1(shipping.line1());
        bid.setShippingAddressLine2(shipping.line2());
        bid.setShippingCity(shipping.city());
        bid.setShippingState(shipping.state());
        bid.setShippingPostalCode(shipping.postalCode());
        bid.setShippingCountry(shipping.country());
    }

    /**
     * Outbid notices quote only the new public price. The competing ceiling is never mentioned, in
     * the message or in the link.
     */
    private void notifyOutbid(List<AuctionBid> newlyOutbid, Auction auction) {
        for (AuctionBid loser : newlyOutbid) {
            notify(loser.getBidder(), "You have been outbid",
                    "Auction: " + auction.getProduct().getName() + System.lineSeparator()
                            + "Current bid: " + auction.getCurrentPrice() + System.lineSeparator()
                            + "Place a higher maximum bid to continue.",
                    "/auctions/" + auction.getId());
        }
    }

    private void notifyLeader(Auction auction, ProxyBiddingEngine.Decision decision, boolean isBidderTheLeader) {
        if (!decision.hasLeader()) {
            return;
        }
        User leader = decision.leader().bidderId() != null
                ? userRepository.findById(decision.leader().bidderId()).orElse(null)
                : null;
        if (leader == null) {
            return;
        }
        notify(leader, isBidderTheLeader ? "You are winning" : "Your bid is leading",
                "'" + shortText(auction.getProduct().getName(), 60) + "' is at " + decision.price()
                        + ". You are the highest bidder.",
                "/auctions/" + auction.getId());
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

    private static boolean isSeller(User user, Auction auction) {
        return auction.getSellerStore() != null
                && auction.getSellerStore().getUser() != null
                && auction.getSellerStore().getUser().getId().equals(user.getId());
    }

    private static void validatePaymentMethod(PaymentMethod method) {
        if (method == null || !ONLINE_PAYMENT_METHODS.contains(method)) {
            throw bad("Auction bids require an online payment method (card, PayPal or Stripe)");
        }
    }

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
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
