package com.groupmart.service;

import com.groupmart.entity.Auction;
import com.groupmart.common.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * The eBay-style proxy (automatic) bidding engine.
 * <p>
 * A customer never bids an amount; they authorise a ceiling. This engine turns the set of private
 * ceilings into the single public price and the current leader, which is what makes the mechanism
 * more than "highest bid wins".
 * <p>
 * <b>Algorithm.</b> Order the eligible bids by maximum descending, breaking an exact tie by the
 * earlier {@code placedAt} (then by id, so the result never depends on row order):
 * <ol>
 *   <li>No bids: the price is the starting price and there is no leader.</li>
 *   <li>One bid: that customer leads at the starting price - they cannot bid against themselves,
 *       so their ceiling is not spent.</li>
 *   <li>Two or more: the leader is the top-ranked bid. Their public price is
 *       {@code min(leaderMaximum, runnerUpMaximum + minimumBidIncrement)} - the least amount that
 *       still beats the runner-up by one increment, but never more than the leader authorised.</li>
 * </ol>
 * The same expression produces the final price when the auction closes, so the winner pays the
 * second-highest maximum plus one increment, not their own ceiling. A lone bidder at the end of the
 * auction therefore pays the starting price.
 * <p>
 * Deliberately free of persistence, locking and notifications: the caller owns the transaction, and
 * that keeps the pricing rule unit-testable on its own.
 */
@Component
public class ProxyBiddingEngine {

    /** One bid as the engine needs it, decoupled from the entity so the rule is testable in isolation. */
    public record Candidate(UUID bidId, UUID bidderId, BigDecimal maximumBid, int quantity,
                            LocalDateTime placedAt) {
    }

    /**
     * The public outcome of a recomputation: what the price becomes, who leads, and which bids
     * fell behind.
     */
    public record Decision(BigDecimal price, Candidate leader, List<UUID> losingBidIds,
                           BigDecimal leaderMaximum, boolean leaderChanged) {

        public boolean hasLeader() {
            return leader != null;
        }
    }

    /**
     * The least the leader must pay to stay ahead, given the best rival.
     * <p>
     * This is deliberately the same expression the final price uses, so a bid that is winning now
     * cannot be charged less at the close than it was shown while running.
     *
     * @param ranked the eligible bids already ordered highest ceiling first; may be empty or a lone
     *               bidder, in which case the opening price applies
     */
    private static BigDecimal priceFor(List<Candidate> ranked, BigDecimal startingPrice,
                                       BigDecimal increment) {
        if (ranked.isEmpty()) {
            return startingPrice;
        }
        if (ranked.size() == 1) {
            // A lone bidder cannot bid against themselves, so their ceiling is not spent.
            return startingPrice;
        }
        BigDecimal beatRunnerUp = ranked.get(1).maximumBid().add(increment);
        return ranked.get(0).maximumBid().min(beatRunnerUp).max(startingPrice);
    }

    /**
     * Recomputes the public price and the leader from the full set of eligible bids.
     *
     * @param auction supplies the starting price, the increment and the current public price
     * @param candidates every currently eligible bid; ordering does not matter, the engine sorts
     * @param previousLeaderBidId the bid that led before, so the caller can tell whether to notify
     */
    public Decision evaluate(Auction auction, List<Candidate> candidates, UUID previousLeaderBidId) {
        BigDecimal startingPrice = auction.getStartingPrice();
        BigDecimal increment = auction.getMinimumBidIncrement();

        List<Candidate> ranked = rank(candidates);
        BigDecimal price = priceFor(ranked, startingPrice, increment);

        if (ranked.isEmpty()) {
            return new Decision(price, null, List.of(), null, previousLeaderBidId != null);
        }

        Candidate leader = ranked.get(0);
        List<UUID> losing = ranked.stream()
                .skip(1)
                .map(Candidate::bidId)
                .filter(java.util.Objects::nonNull)
                .toList();

        // A leader that did not change and a leader that was just overtaken are different news:
        // null before and set now counts as a change, so the first bidder of the auction still
        // gets a "you are winning" notification.
        boolean leaderChanged = !java.util.Objects.equals(previousLeaderBidId, leader.bidId());

        return new Decision(price, leader, losing, leader.maximumBid(), leaderChanged);
    }

    /**
     * What one bid is publicly committed to.
     * <p>
     * The leader is committed to the current price. A bidder who is not leading has not been beaten
     * past their own authorisation, so their committed amount is capped at their ceiling: showing a
     * lost bidder the price they would need in order to win - which is by definition more than they
     * authorised - misrepresents the bid and made the public ladder show losing bids above the
     * leader.
     */
    public BigDecimal committedAmountFor(Auction auction, List<Candidate> candidates,
                                         UUID bidId) {
        BigDecimal startingPrice = auction.getStartingPrice();
        BigDecimal increment = auction.getMinimumBidIncrement();
        List<Candidate> ranked = rank(candidates);
        BigDecimal price = priceFor(ranked, startingPrice, increment);

        if (ranked.isEmpty() || bidId == null) {
            return startingPrice;
        }
        for (Candidate candidate : ranked) {
            if (bidId.equals(candidate.bidId())) {
                boolean leading = ranked.get(0).bidId().equals(candidate.bidId());
                return leading ? price : price.min(candidate.maximumBid());
            }
        }
        return startingPrice;
    }

    /**
     * The least a new bidder must authorise to be able to lead, which is the current price plus one
     * increment. Deriving it from the public price rather than from any ceiling is what keeps every
     * ceiling private.
     */
    public BigDecimal minimumToLead(Auction auction, List<Candidate> candidates) {
        return priceFor(rank(candidates), auction.getStartingPrice(), auction.getMinimumBidIncrement())
                .add(auction.getMinimumBidIncrement());
    }

    private static List<Candidate> rank(List<Candidate> candidates) {
        List<Candidate> ranked = new ArrayList<>(candidates);
        ranked.sort(Comparator
                .comparing(Candidate::maximumBid, Comparator.reverseOrder())
                .thenComparing(Candidate::placedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(Candidate::bidId, Comparator.nullsLast(Comparator.naturalOrder())));
        return ranked;
    }

    /**
     * The least a new bidder may authorise, derived from the public price. The server is the only
     * authority: the frontend never decides this.
     */
    public BigDecimal minimumAcceptableMaximum(Auction auction) {
        return auction.getCurrentPrice().add(auction.getMinimumBidIncrement());
    }

    /** Guard used before a bid is stored, so a rejection always names the exact figure required. */
    public void requireMaximumAtLeast(Auction auction, BigDecimal maximumBid) {
        BigDecimal required = minimumAcceptableMaximum(auction);
        if (maximumBid == null || maximumBid.compareTo(required) < 0) {
            throw new ApiException("Your maximum bid must be at least " + required
                    + " (the current price of " + auction.getCurrentPrice()
                    + " plus the " + auction.getMinimumBidIncrement() + " minimum increment)",
                    HttpStatus.BAD_REQUEST);
        }
    }

    /**
     * Guards a bid against the price it would actually have to beat.
     * <p>
     * The public price alone is not a sufficient threshold once a ceiling is far above it: a bidder
     * who authorises less than the leader's committed price would silently be outbid while believing
     * they had entered. Comparing against the least amount that could take the lead means an accepted
     * bid is never a bid that is already losing.
     */
    public void requireMaximumToLead(Auction auction, List<Candidate> candidates, BigDecimal maximumBid) {
        BigDecimal required = minimumToLead(auction, candidates);
        if (maximumBid == null || maximumBid.compareTo(required) < 0) {
            throw new ApiException("Your maximum bid must be at least " + required
                    + " to take the lead on this auction", HttpStatus.BAD_REQUEST);
        }
    }
}
