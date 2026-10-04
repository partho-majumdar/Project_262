package com.groupmart.service.impl;

import com.groupmart.dto.auction.AuctionDto;
import com.groupmart.dto.auction.BidHistoryEntryDto;
import com.groupmart.dto.auction.MyAuctionBidDto;
import com.groupmart.dto.auction.MyBidViewDto;
import com.groupmart.dto.auction.SellerAuctionBidDto;
import com.groupmart.dto.auction.SellerAuctionDto;
import com.groupmart.entity.Auction;
import com.groupmart.entity.AuctionBid;
import com.groupmart.entity.AuctionBidStatus;
import com.groupmart.entity.AuctionStatus;
import com.groupmart.entity.Order;
import com.groupmart.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.groupmart.repository.AuctionBidRepository;
import com.groupmart.repository.OrderRepository;
import com.groupmart.service.ProxyBiddingEngine;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Turns {@link Auction} rows into responses.
 * <p>
 * The split between {@link #toPublicDto} and {@link #toSellerDto} is the privacy boundary of the
 * whole feature: the reserve price and the winner's identity exist only in the seller mapping,
 * and no maximum bid is reachable from either.
 */
@Component
@RequiredArgsConstructor
public class AuctionMapper {

    private final OrderRepository orderRepository;
    private final AuctionBidRepository auctionBidRepository;

    /** Public projection: safe to serve unauthenticated. */
    public AuctionDto toPublicDto(Auction auction) {
        return toPublicDto(auction, LocalDateTime.now());
    }

    public AuctionDto toPublicDto(Auction auction, LocalDateTime now) {
        long remaining = secondsUntil(auction.getEndsAt(), now);

        return AuctionDto.builder()
                .id(auction.getId())
                .productId(auction.getProduct().getId())
                .productName(auction.getProduct().getName())
                .productSlug(auction.getProduct().getSlug())
                .productImageUrl(firstImage(auction))
                .productDescription(auction.getProduct().getDescription())
                .productPrice(auction.getProduct().getPrice())
                .sellerStoreId(auction.getSellerStore().getId())
                .sellerStoreName(auction.getSellerStore().getStoreName())
                .sellerStoreSlug(auction.getSellerStore().getStoreSlug())
                .description(auction.getDescription())
                .status(auction.getStatus())
                .quantity(auction.getQuantity())
                .startingPrice(auction.getStartingPrice())
                .currentPrice(auction.getStatus() == AuctionStatus.SOLD
                        ? orZero(auction.getFinalPrice())
                        : auction.getCurrentPrice())
                .minimumBidIncrement(auction.getMinimumBidIncrement())
                .minimumNextBid(auction.minimumNextBid())
                .bidCount(auction.getBidCount())
                .bidderCount(auction.getBidderCount())
                // The value stays behind; only its existence and whether it is met is public.
                .hasReserve(auction.hasReserve())
                .reserveMet(auction.isReserveMet())
                .startsAt(auction.getStartsAt())
                .endsAt(auction.getEndsAt())
                .serverTime(now)
                .timeRemainingSeconds(remaining)
                .acceptingBids(auction.acceptsBidsAt(now))
                .winnerBidId(auction.getWinningBidId())
                .winnerAlias(auction.getWinner() != null ? BidderAlias.of(auction.getWinner()) : null)
                .finalPrice(auction.getFinalPrice())
                .closeCode(auction.getCloseCode() != null ? auction.getCloseCode().name() : null)
                .closeCodeLabel(auction.getCloseCode() != null ? auction.getCloseCode().getLabel() : null)
                .closeNote(auction.getCloseNote())
                .endedAt(auction.getEndedAt())
                .build();
    }

    /** Seller/admin projection: adds the reserve price and the winner's real identity. */
    public SellerAuctionDto toSellerDto(Auction auction) {
        LocalDateTime now = LocalDateTime.now();
        long remaining = secondsUntil(auction.getEndsAt(), now);
        Order order = auction.getWinnerOrderId() == null
                ? null
                : orderRepository.findById(auction.getWinnerOrderId()).orElse(null);

        return SellerAuctionDto.builder()
                .id(auction.getId())
                .productId(auction.getProduct().getId())
                .productName(auction.getProduct().getName())
                .productSlug(auction.getProduct().getSlug())
                .productImageUrl(firstImage(auction))
                .sellerStoreId(auction.getSellerStore().getId())
                .sellerStoreName(auction.getSellerStore().getStoreName())
                .description(auction.getDescription())
                .status(auction.getStatus())
                .quantity(auction.getQuantity())
                .startingPrice(auction.getStartingPrice())
                .currentPrice(auction.getCurrentPrice())
                .minimumBidIncrement(auction.getMinimumBidIncrement())
                .minimumNextBid(auction.minimumNextBid())
                .reservePrice(auction.getReservePrice())
                .reserveMet(auction.isReserveMet())
                .bidCount(auction.getBidCount())
                .bidderCount(auction.getBidderCount())
                .startsAt(auction.getStartsAt())
                .endsAt(auction.getEndsAt())
                .serverTime(now)
                .timeRemainingSeconds(remaining)
                .acceptingBids(auction.acceptsBidsAt(now))
                .winnerBidId(auction.getWinningBidId())
                .winnerName(auction.getWinner() != null
                        ? auction.getWinner().getFirstName() + " " + auction.getWinner().getLastName() : null)
                .winnerEmail(auction.getWinner() != null ? auction.getWinner().getEmail() : null)
                .finalPrice(auction.getFinalPrice())
                .winnerOrderId(auction.getWinnerOrderId())
                .winnerOrderNumber(order != null ? order.getOrderNumber() : null)
                .unitsSold(winningQuantity(auction))
                .closeCode(auction.getCloseCode() != null ? auction.getCloseCode().name() : null)
                .closeCodeLabel(auction.getCloseCode() != null ? auction.getCloseCode().getLabel() : null)
                .closeNote(auction.getCloseNote())
                .endedAt(auction.getEndedAt())
                .inventoryReserved(auction.isInventoryReserved())
                .createdAt(auction.getCreatedAt())
                .updatedAt(auction.getUpdatedAt())
                .build();
    }

    /** A bidder's own bid, including the private ceiling. Only ever called for the owner. */
    public MyAuctionBidDto toMyBidDto(AuctionBid bid, Auction auction) {
        return toMyBidDto(bid, auction, bid.getEffectiveBid());
    }

    /**
     * A bidder's own bid with a caller-derived committed amount.
     * <p>
     * The amount is passed in rather than read from the row so the caller can price it against the
     * current ranking. Reading the stored value here would show a customer a figure that no longer
     * matches the auction they are looking at.
     */
    public MyAuctionBidDto toMyBidDto(AuctionBid bid, Auction auction, BigDecimal committedAmount) {
        LocalDateTime now = LocalDateTime.now();
        boolean winning = auction.getLeadingBidId() != null
                && auction.getLeadingBidId().equals(bid.getId())
                && auction.getStatus().acceptsBids();

        return MyAuctionBidDto.builder()
                .id(bid.getId())
                .auctionId(auction.getId())
                .auctionStatus(auction.getStatus().name())
                .productName(auction.getProduct().getName())
                .productImageUrl(firstImage(auction))
                .maximumBid(bid.getMaximumBid())
                .effectiveBid(committedAmount)
                .quantity(bid.getQuantity())
                .status(bid.getStatus())
                .winning(winning)
                .currentPrice(auction.getCurrentPrice())
                .minimumNextBid(auction.minimumNextBid())
                .hasReserve(auction.hasReserve())
                .reserveMet(auction.isReserveMet())
                .placedAt(bid.getPlacedAt())
                .auctionEndsAt(auction.getEndsAt())
                .timeRemainingSeconds(secondsUntil(auction.getEndsAt(), now))
                .amountPaid(bid.getAmountPaid())
                .orderId(bid.getOrderId())
                .build();
    }

    /** One "My bids" row: the auction beside the caller's own private bid. */
    public MyBidViewDto toMyBidView(AuctionBid bid, Auction auction) {
        return toMyBidView(bid, auction, bid.getEffectiveBid());
    }

    /** As above, with the committed amount derived by the caller from the current ranking. */
    public MyBidViewDto toMyBidView(AuctionBid bid, Auction auction, BigDecimal committedAmount) {
        LocalDateTime now = LocalDateTime.now();
        boolean leadingNow = auction.getLeadingBidId() != null && auction.getLeadingBidId().equals(bid.getId());

        return MyBidViewDto.builder()
                .bidId(bid.getId())
                .auctionId(auction.getId())
                .productName(auction.getProduct().getName())
                .productImageUrl(firstImage(auction))
                .sellerStoreName(auction.getSellerStore().getStoreName())
                .auctionStatus(auction.getStatus())
                .bidStatus(bid.getStatus())
                .maximumBid(bid.getMaximumBid())
                .effectiveBid(committedAmount)
                .quantity(bid.getQuantity())
                .currentPrice(auction.getCurrentPrice())
                .minimumNextBid(auction.minimumNextBid())
                .finalPrice(auction.getFinalPrice())
                .hasReserve(auction.hasReserve())
                .reserveMet(auction.isReserveMet())
                .winning(leadingNow && auction.getStatus().acceptsBids())
                .outcome(outcomeOf(bid, auction, leadingNow))
                .placedAt(bid.getPlacedAt())
                .endsAt(auction.getEndsAt())
                .timeRemainingSeconds(secondsUntil(auction.getEndsAt(), now))
                .acceptingBids(auction.acceptsBidsAt(now))
                .amountPaid(bid.getAmountPaid())
                .orderId(bid.getOrderId())
                .orderNumber(orderNumberOf(bid))
                .build();
    }

    /**
     * Public bid history. Amounts are derived from the live bid set, aliases are pseudonymous, and no
     * maximum bid is read here at all.
     * <p>
     * {@code candidates} is every currently eligible bid and {@code engine} prices them, so each row
     * shows the amount that bid is committed to as things stand now. Passing them in is what keeps
     * the ladder from reporting a superseded amount left over from an earlier ranking.
     */
    public List<BidHistoryEntryDto> toBidHistory(Auction auction, List<AuctionBid> bidsNewestFirst,
                                                 List<ProxyBiddingEngine.Candidate> candidates,
                                                 ProxyBiddingEngine engine) {
        List<BidHistoryEntryDto> entries = new java.util.ArrayList<>(bidsNewestFirst.size());
        long sequence = bidsNewestFirst.size();
        for (AuctionBid bid : bidsNewestFirst) {
            boolean leading = auction.getLeadingBidId() != null
                    && auction.getLeadingBidId().equals(bid.getId());
            entries.add(BidHistoryEntryDto.builder()
                    .sequence(sequence--)
                    .bidderAlias(BidderAlias.of(bid.getBidder()))
                    .amount(engine.committedAmountFor(auction, candidates, bid.getId()))
                    .quantity(bid.getQuantity())
                    .placedAt(bid.getPlacedAt())
                    .leading(leading)
                    .build());
        }
        return entries;
    }

    // ----- Helpers ----------------------------------------------------------------------------

    /**
     * The seller projection of one bid.
     * <p>
     * Ordered by standing rather than by time, so the leading bid is the first row the seller
     * reads. Each row carries the real bidder, the amount they are committed to and the ceiling
     * behind it - the three things a seller needs and a public viewer must not have.
     */
    public List<SellerAuctionBidDto> toSellerBids(Auction auction, List<AuctionBid> bids,
                                                  List<ProxyBiddingEngine.Candidate> candidates,
                                                  ProxyBiddingEngine engine) {
        List<AuctionBid> ordered = new java.util.ArrayList<>(bids);
        ordered.sort(java.util.Comparator
                .comparing((AuctionBid b) -> auction.getLeadingBidId() != null
                                && auction.getLeadingBidId().equals(b.getId()) ? 0 : 1)
                .thenComparing(AuctionBid::getMaximumBid,
                        java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder()))
                .thenComparing(AuctionBid::getPlacedAt,
                        java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())));

        return ordered.stream().map(bid -> toSellerBidDto(auction, bid, candidates, engine)).toList();
    }

    private SellerAuctionBidDto toSellerBidDto(Auction auction, AuctionBid bid,
                                              List<ProxyBiddingEngine.Candidate> candidates,
                                              ProxyBiddingEngine engine) {
        User bidder = bid.getBidder();
        boolean leading = auction.getLeadingBidId() != null && auction.getLeadingBidId().equals(bid.getId());
        // Raised means the ceiling itself moved after the bid was placed. It deliberately does not
        // use updatedAt: re-pricing the auction re-saves every bid row, so a timestamp comparison
        // flagged every losing bidder as having raised once anybody else bid.
        boolean revised = bid.getCeilingRaisedAt() != null;
        // Derived, never the stored column: a withdrawn or superseded bid would otherwise keep
        // reporting the amount that was committed to it at some earlier point in the auction.
        BigDecimal amount = bid.isEligible()
                ? engine.committedAmountFor(auction, candidates, bid.getId())
                : bid.getEffectiveBid();

        return SellerAuctionBidDto.builder()
                .bidId(bid.getId())
                .bidderName(bidder == null ? null
                        : (bidder.getFirstName() + " " + bidder.getLastName()).trim())
                .bidderEmail(bidder == null ? null : bidder.getEmail())
                .bidderAlias(BidderAlias.of(bidder))
                .amount(amount)
                .maximumBid(bid.getMaximumBid())
                .quantity(bid.getQuantity())
                .status(bid.getStatus() != null ? bid.getStatus().name() : null)
                .leading(leading)
                .placedAt(bid.getPlacedAt())
                .updatedAt(bid.getUpdatedAt())
                .revised(revised)
                .amountPaid(bid.getAmountPaid())
                .orderNumber(orderNumberOf(bid))
                .cancellationReason(bid.getCancellationReason())
                .build();
    }

    /** A single word describing where the customer's bid ended up, for the "My bids" filters. */
    private String outcomeOf(AuctionBid bid, Auction auction, boolean leadingNow) {
        if (bid.getStatus() == AuctionBidStatus.WON) {
            return "WON";
        }
        if (bid.getStatus() == AuctionBidStatus.LOST) {
            return "LOST";
        }
        if (bid.getStatus() == AuctionBidStatus.CANCELLED) {
            return "CANCELLED";
        }
        if (auction.getStatus().isTerminal()) {
            return "ENDED_WITHOUT_SALE";
        }
        return leadingNow ? "WINNING" : "OUTBID";
    }

    private String orderNumberOf(AuctionBid bid) {
        if (bid.getOrderId() == null) {
            return null;
        }
        return orderRepository.findById(bid.getOrderId()).map(Order::getOrderNumber).orElse(null);
    }

    private int winningQuantity(Auction auction) {
        if (auction.getWinningBidId() == null) {
            return 0;
        }
        return auctionBidRepository.findById(auction.getWinningBidId())
                .map(AuctionBid::getQuantity)
                .orElse(0);
    }

    private static String firstImage(Auction auction) {
        List<String> images = auction.getProduct().getImageUrls();
        return images != null && !images.isEmpty() ? images.get(0) : null;
    }

    private static long secondsUntil(LocalDateTime target, LocalDateTime now) {
        if (target == null) {
            return 0L;
        }
        long seconds = Duration.between(now, target).getSeconds();
        return Math.max(0L, seconds);
    }

    private static BigDecimal orZero(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }}
