package com.groupmart.auction;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.groupmart.entity.Auction;
import com.groupmart.service.ProxyBiddingEngine;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The proxy-bidding rule on its own, with no database and no auction state that a previous case
 * could have left behind. Everything here is the arithmetic a customer would see on the page, so a
 * failure points straight at the pricing logic rather than at plumbing.
 */
class ProxyBiddingEngineTest {

    private final ProxyBiddingEngine engine = new ProxyBiddingEngine();

    private static final BigDecimal START = new BigDecimal("5000");
    private static final BigDecimal INCREMENT = new BigDecimal("100");

    private Auction auction() {
        return Auction.builder()
                .id(UUID.randomUUID())
                .startingPrice(START)
                .minimumBidIncrement(INCREMENT)
                .currentPrice(START)
                .build();
    }

    private ProxyBiddingEngine.Candidate candidate(BigDecimal max, int minutesAgo) {
        return new ProxyBiddingEngine.Candidate(
                UUID.randomUUID(),
                UUID.randomUUID(),
                max,
                1,
                LocalDateTime.now().minusMinutes(minutesAgo));
    }

    @Test
    void anAuctionWithNoBidsSitsAtTheStartingPrice() {
        ProxyBiddingEngine.Decision decision = engine.evaluate(auction(), List.of(), null);

        assertThat(decision.price()).isEqualByComparingTo(START);
        assertThat(decision.hasLeader()).isFalse();
    }

    @Test
    void aLoneBidderLeadsAtTheStartingPriceRatherThanAtTheirCeiling() {
        ProxyBiddingEngine.Candidate only = candidate(new BigDecimal("8000"), 1);

        ProxyBiddingEngine.Decision decision = engine.evaluate(auction(), List.of(only), null);

        assertThat(decision.leader().bidId()).isEqualTo(only.bidId());
        assertThat(decision.price())
                .as("a bidder must not spend their ceiling just to be the only one")
                .isEqualByComparingTo(START);
    }

    @Test
    void aCompetingCeilingRaisesTheLeadersPriceByExactlyOneIncrement() {
        ProxyBiddingEngine.Candidate leader = candidate(new BigDecimal("8000"), 2);
        ProxyBiddingEngine.Candidate rival = candidate(new BigDecimal("6000"), 1);

        ProxyBiddingEngine.Decision decision = engine.evaluate(auction(), List.of(leader, rival), null);

        assertThat(decision.leader().bidId()).isEqualTo(leader.bidId());
        assertThat(decision.price())
                .as("6000 + 100 beats the rival, and is still under the leader's 8000")
                .isEqualByComparingTo(new BigDecimal("6100"));
    }

    @Test
    void thePriceIsCappedByTheLeadersOwnCeiling() {
        ProxyBiddingEngine.Candidate leader = candidate(new BigDecimal("6200"), 2);
        ProxyBiddingEngine.Candidate rival = candidate(new BigDecimal("6100"), 1);

        ProxyBiddingEngine.Decision decision = engine.evaluate(auction(), List.of(leader, rival), null);

        assertThat(decision.price())
                .as("the leader cannot be pushed past what they authorised")
                .isEqualByComparingTo(new BigDecimal("6200"));
    }

    @Test
    void theHighestCeilingWinsWithoutPayingIt() {
        ProxyBiddingEngine.Candidate a = candidate(new BigDecimal("8000"), 3);
        ProxyBiddingEngine.Candidate b = candidate(new BigDecimal("7000"), 2);
        ProxyBiddingEngine.Candidate c = candidate(new BigDecimal("9000"), 1);

        ProxyBiddingEngine.Decision decision = engine.evaluate(auction(), List.of(a, b, c), a.bidId());

        assertThat(decision.leader().bidId()).isEqualTo(c.bidId());
        assertThat(decision.price())
                .as("8000 + 100, not the 9000 ceiling")
                .isEqualByComparingTo(new BigDecimal("8100"));
        assertThat(decision.leaderMaximum()).isEqualByComparingTo(new BigDecimal("9000"));
    }

    @Test
    void anExactTieIsBrokenDeterministicallyInFavourOfTheEarlierBid() {
        UUID earlierBid = UUID.randomUUID();
        UUID laterBid = UUID.randomUUID();
        UUID earlierUser = UUID.randomUUID();
        UUID laterUser = UUID.randomUUID();
        LocalDateTime base = LocalDateTime.now();

        ProxyBiddingEngine.Candidate first = new ProxyBiddingEngine.Candidate(
                earlierBid, earlierUser, new BigDecimal("7000"), 1, base.minusMinutes(5));
        ProxyBiddingEngine.Candidate second = new ProxyBiddingEngine.Candidate(
                laterBid, laterUser, new BigDecimal("7000"), 1, base.minusMinutes(1));

        // The winner must not depend on which order the rows came back in.
        for (int i = 0; i < 20; i++) {
            ProxyBiddingEngine.Decision forward = engine.evaluate(auction(), List.of(first, second), null);
            ProxyBiddingEngine.Decision reversed = engine.evaluate(auction(), List.of(second, first), null);

            assertThat(forward.leader().bidId()).isEqualTo(earlierBid);
            assertThat(reversed.leader().bidId()).isEqualTo(earlierBid);
        }
    }

    @Test
    void theMinimumAcceptableMaximumTracksThePublicPriceAndTheIncrement() {
        Auction auction = auction();
        auction.setCurrentPrice(new BigDecimal("5100"));

        assertThat(engine.minimumAcceptableMaximum(auction)).isEqualByComparingTo(new BigDecimal("5200"));
    }

    @Test
    void aMaximumBelowTheThresholdIsRejectedWithTheExactFigureRequired() {
        Auction auction = auction();
        auction.setCurrentPrice(new BigDecimal("5100"));

        assertThatThrownBy(() -> engine.requireMaximumAtLeast(auction, new BigDecimal("5150")))
                .hasMessageContaining("5200");
    }

    @Test
    void theEngineNeverReportsAPriceBelowTheStartingPrice() {
        Auction auction = auction();
        ProxyBiddingEngine.Candidate leader = candidate(new BigDecimal("1"), 2);
        ProxyBiddingEngine.Candidate rival = candidate(new BigDecimal("1"), 1);

        ProxyBiddingEngine.Decision decision = engine.evaluate(auction, List.of(leader, rival), null);

        assertThat(decision.price()).isEqualByComparingTo(START);
    }

    // ----- Committed amounts ---------------------------------------------------------------------

    /** A losing bid must be committed to no more than its own ceiling, never to the price to lead. */
    @Test
    void aLosingBidIsCommittedToNoMoreThanItsOwnCeiling() {
        Auction auction = auction();
        ProxyBiddingEngine.Candidate leader = candidate(new BigDecimal("8000"), 2);
        ProxyBiddingEngine.Candidate loser = candidate(new BigDecimal("6000"), 1);

        List<ProxyBiddingEngine.Candidate> candidates = List.of(leader, loser);
        ProxyBiddingEngine.Decision decision = engine.evaluate(auction, candidates, leader.bidId());

        assertThat(engine.committedAmountFor(auction, candidates, leader.bidId()))
                .as("the leader is committed to the public price")
                .isEqualByComparingTo(decision.price());
        assertThat(engine.committedAmountFor(auction, candidates, loser.bidId()))
                .as("the price to lead (6200) is above what the loser authorised, so it is not committed")
                .isEqualByComparingTo(new BigDecimal("6000"));
    }

    @Test
    void aLosingBidAboveThePublicPriceKeepsItsCeilingAsTheCommittedAmount() {
        Auction auction = auction();
        // The 9000 ceiling leads and the price is capped by the 6200 runner-up, so the two losing
        // bids sit below a price they are nonetheless still authorised to meet.
        ProxyBiddingEngine.Candidate leader = candidate(new BigDecimal("9000"), 1);
        ProxyBiddingEngine.Candidate second = candidate(new BigDecimal("6200"), 2);
        ProxyBiddingEngine.Candidate third = candidate(new BigDecimal("6100"), 3);

        List<ProxyBiddingEngine.Candidate> candidates = List.of(leader, second, third);
        ProxyBiddingEngine.Decision decision = engine.evaluate(auction, candidates, null);

        assertThat(decision.leader().bidId()).isEqualTo(leader.bidId());
        assertThat(decision.price()).isEqualByComparingTo(new BigDecimal("6300"));
        assertThat(engine.committedAmountFor(auction, candidates, second.bidId()))
                .as("6400 is the price to lead, but 6200 is all that was authorised")
                .isEqualByComparingTo(new BigDecimal("6200"));
        assertThat(engine.committedAmountFor(auction, candidates, third.bidId()))
                .isEqualByComparingTo(new BigDecimal("6100"));
    }

    @Test
    void aLoneBiddersCommittedAmountIsTheOpeningPrice() {
        Auction auction = auction();
        ProxyBiddingEngine.Candidate only = candidate(new BigDecimal("8000"), 1);
        List<ProxyBiddingEngine.Candidate> candidates = List.of(only);

        assertThat(engine.committedAmountFor(auction, candidates, only.bidId()))
                .isEqualByComparingTo(START);
    }

    // ----- The minimum needed to lead -----------------------------------------------------------

    @Test
    void theMinimumToLeadIsTheCurrentPricePlusOneIncrement() {
        Auction auction = auction();
        ProxyBiddingEngine.Candidate leader = candidate(new BigDecimal("8000"), 2);
        ProxyBiddingEngine.Candidate rival = candidate(new BigDecimal("6000"), 1);

        assertThat(engine.minimumToLead(auction, List.of(leader, rival)))
                .as("6100 is the running price, so 6200 takes the lead")
                .isEqualByComparingTo(new BigDecimal("6200"));
    }

    @Test
    void onAnAuctionWithNoBidsTheMinimumToLeadIsOneIncrementAboveTheOpeningPrice() {
        assertThat(engine.minimumToLead(auction(), List.of()))
                .isEqualByComparingTo(new BigDecimal("5100"));
    }

    /** A ceiling under the amount needed to take the lead must be refused with that exact figure. */
    @Test
    void aCeilingBelowTheAmountNeededToLeadIsRejected() {
        Auction auction = auction();
        ProxyBiddingEngine.Candidate leader = candidate(new BigDecimal("8000"), 2);
        ProxyBiddingEngine.Candidate rival = candidate(new BigDecimal("6000"), 1);
        List<ProxyBiddingEngine.Candidate> candidates = List.of(leader, rival);

        assertThatThrownBy(() -> engine.requireMaximumToLead(auction, candidates, new BigDecimal("6100")))
                .hasMessageContaining("6200");
    }

    // ----- Leader change ------------------------------------------------------------------------

    @Test
    void aLeaderIsReportedAsChangedOnlyWhenItActuallyChanges() {
        Auction auction = auction();
        ProxyBiddingEngine.Candidate a = candidate(new BigDecimal("8000"), 3);
        ProxyBiddingEngine.Candidate b = candidate(new BigDecimal("6000"), 1);

        assertThat(engine.evaluate(auction, List.of(a, b), a.bidId()).leaderChanged())
                .as("A already led, so the standing leader is not news")
                .isFalse();
        assertThat(engine.evaluate(auction, List.of(a, b), b.bidId()).leaderChanged())
                .as("B is behind, so A taking the lead is news")
                .isTrue();
        assertThat(engine.evaluate(auction, List.of(a), null).leaderChanged())
                .as("the very first bid of an auction is a change, so the bidder is told they won")
                .isTrue();
    }
}
