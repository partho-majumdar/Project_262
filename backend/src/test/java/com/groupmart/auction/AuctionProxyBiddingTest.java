package com.groupmart.auction;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.groupmart.dto.auction.AuctionDto;
import com.groupmart.dto.auction.BidHistoryEntryDto;
import com.groupmart.entity.*;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The headline behaviour: a customer authorises a ceiling, the system bids on their behalf, and the
 * ceiling never becomes the public price.
 */
class AuctionProxyBiddingTest extends AbstractAuctionIntegrationTest {

    private static final BigDecimal START = new BigDecimal("5000");
    private static final BigDecimal INCREMENT = new BigDecimal("100");

    @Test
    void aHigherCeilingTakesTheLeadAndTheLoserPaysOnlyOneIncrementMore() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        Address addressA = createAddress(a);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        Address addressB = createAddress(b);

        // A alone: leading, but still at the opening price - a bidder never spends its ceiling.
        var bidA = bid(a, addressA, auction, new BigDecimal("8000"));
        assertThat(bidA.isWinning()).isTrue();
        assertThat(reload(auction.getId()).getCurrentPrice()).isEqualByComparingTo(START);

        // B arrives; the engine keeps A ahead, raising the price by one increment only.
        bid(b, addressB, auction, new BigDecimal("6000"));

        Auction running = reload(auction.getId());
        assertThat(running.getCurrentPrice())
                .as("6000 + 100 to stay ahead of B")
                .isEqualByComparingTo(new BigDecimal("6100"));
        assertThat(running.getLeadingBidder().getId()).isEqualTo(a.getId());
        assertThat(running.getBidCount()).isEqualTo(2);

        // A's own view: winning, at 6100, with the ceiling still private to A.
        var aView = biddingService.getMyBid(a.getEmail(), auction.getId());
        assertThat(aView.isWinning()).isTrue();
        assertThat(aView.getMaximumBid()).isEqualByComparingTo(new BigDecimal("8000"));
        assertThat(bViewIsOutbid(b, auction)).isTrue();
    }

    @Test
    void thePublicPriceNeverEqualsALeadersPrivateMaximum() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        User c = createUser("c", Role.ROLE_CUSTOMER);

        bid(a, createAddress(a), auction, new BigDecimal("8000"));
        bid(b, createAddress(b), auction, new BigDecimal("7000"));
        bid(c, createAddress(c), auction, new BigDecimal("9000"));

        Auction running = reload(auction.getId());
        assertThat(running.getLeadingBidder().getId()).isEqualTo(c.getId());
        assertThat(running.getCurrentPrice())
                .as("8000 (the runner-up) + 100, capped well under C's 9000")
                .isEqualByComparingTo(new BigDecimal("8100"));
        assertThat(running.getCurrentPrice())
                .isLessThan(new BigDecimal("9000"));
    }

    @Test
    void aPublicAuctionResponseNeverCarriesAnyMaximumBid() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        bid(a, createAddress(a), auction, new BigDecimal("8000"));
        bid(b, createAddress(b), auction, new BigDecimal("6000"));

        // The public view and the public history are the only things an outsider can read.
        var publicAuction = auctionService.getPublicAuction(auction.getId());
        var history = biddingService.getBidHistory(auction.getId());

        assertThat(publicAuction.getCurrentPrice()).isEqualByComparingTo(new BigDecimal("6100"));
        assertThat(history).hasSize(2);
        assertThat(history)
                .as("no history row may repeat a ceiling")
                .noneMatch(entry -> entry.getAmount().compareTo(new BigDecimal("8000")) == 0);
        assertThat(history)
                .as("bidders are pseudonymous, never named or emailed")
                .allSatisfy(entry -> {
                    assertThat(entry.getBidderAlias()).startsWith("Bidder #");
                    assertThat(entry.getBidderAlias()).doesNotContain("@");
                });
        // Only one of the two rows is flagged as leading.
        assertThat(history).filteredOn(entry -> entry.isLeading()).hasSize(1);
    }

    @Test
    void raisingYourOwnCeilingKeepsTheSamePublicPriceButIsStillAccepted() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        Address addressA = createAddress(a);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        Address addressB = createAddress(b);

        bid(a, addressA, auction, new BigDecimal("8000"));
        bid(b, addressB, auction, new BigDecimal("6000"));
        assertThat(reload(auction.getId()).getCurrentPrice()).isEqualByComparingTo(new BigDecimal("6100"));

        // A strengthens the ceiling it is already relying on: the price is set by B, not A.
        var raised = bid(a, addressA, auction, new BigDecimal("12000"));

        Auction running = reload(auction.getId());
        assertThat(running.getCurrentPrice()).isEqualByComparingTo(new BigDecimal("6100"));
        assertThat(running.getLeadingBidder().getId()).isEqualTo(a.getId());
        assertThat(raised.getMaximumBid()).isEqualByComparingTo(new BigDecimal("12000"));
        assertThat(allBids(auction.getId()))
                .as("raising a ceiling must not create a second bid row")
                .hasSize(2);
    }

    @Test
    void aCeilingThatIsNotHigherThanTheExistingOneIsRejected() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        Address addressA = createAddress(a);
        bid(a, addressA, auction, new BigDecimal("8000"));

        assertThatThrownBy(() -> bid(a, addressA, auction, new BigDecimal("8000")))
                .hasMessageContaining("higher than");
        assertThatThrownBy(() -> bid(a, addressA, auction, new BigDecimal("7000")))
                .hasMessageContaining("higher than");
    }

    @Test
    void aCeilingBelowTheThresholdIsRejectedByTheServer() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        bid(a, createAddress(a), auction, new BigDecimal("8000"));

        // The public price is 5000, so the next ceiling must reach 5100.
        assertThatThrownBy(() -> bid(b, createAddress(b), auction, new BigDecimal("5050")))
                .hasMessageContaining("5100");
    }

    @Test
    void withdrawingABidHandsTheLeadToTheNextBidder() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        Address addressA = createAddress(a);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        Address addressB = createAddress(b);

        var bidA = bid(a, addressA, auction, new BigDecimal("8000"));
        bid(b, addressB, auction, new BigDecimal("6000"));
        assertThat(reload(auction.getId()).getLeadingBidder().getId()).isEqualTo(a.getId());

        biddingService.withdrawBid(a.getEmail(), bidA.getId(), "changed my mind");

        Auction running = reload(auction.getId());
        assertThat(running.getLeadingBidder().getId()).isEqualTo(b.getId());
        assertThat(running.getCurrentPrice())
                .as("B is now alone, so it is back to the opening price")
                .isEqualByComparingTo(START);
    }

    @Test
    void nobodyCanReadSomebodyElsesMaximumBid() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        bid(a, createAddress(a), auction, new BigDecimal("8000"));

        assertThatThrownBy(() -> biddingService.getMyBid(b.getEmail(), auction.getId()))
                .hasMessageContaining("have not bid");
    }

    // ----- Regressions: the reported defects ---------------------------------------------------

    /**
     * The stored {@code effective_bid} column is rewritten whenever the ranking is recomputed, so it
     * cannot be trusted as the source of a display figure. Reading it back left losing bids showing a
     * superseded amount above the leader - the ladder looked broken even though the price and the
     * leader were right.
     */
    @Test
    void theLadderIsDerivedRatherThanReadFromTheStoredAmount() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        User c = createUser("c", Role.ROLE_CUSTOMER);

        bid(a, createAddress(a), auction, new BigDecimal("8000"));
        bid(b, createAddress(b), auction, new BigDecimal("6000"));
        bid(c, createAddress(c), auction, new BigDecimal("7000"));

        // Corrupt the stored amounts the way an older row would be left behind, then prove every
        // read path ignores them and prices from the live bid set instead.
        allBids(auction.getId()).forEach(bid -> {
            bid.setEffectiveBid(new BigDecimal("99999"));
            bidRepository.save(bid);
        });

        var history = biddingService.getBidHistory(auction.getId());
        assertThat(history)
                .as("a corrupted stored amount must never reach the public ladder")
                .noneMatch(entry -> entry.getAmount().compareTo(new BigDecimal("99999")) == 0);

        var leading = history.stream().filter(BidHistoryEntryDto::isLeading).findFirst().orElseThrow();
        assertThat(leading.getAmount()).isEqualByComparingTo(new BigDecimal("7100"));
        assertThat(history)
                .filteredOn(entry -> !entry.isLeading())
                .allSatisfy(entry -> assertThat(entry.getAmount())
                        .isLessThanOrEqualTo(leading.getAmount()));

        // The bidder's own page and the seller's page must agree with the ladder.
        assertThat(biddingService.getMyBid(b.getEmail(), auction.getId()).getEffectiveBid())
                .isEqualByComparingTo(new BigDecimal("6000"));
        assertThat(biddingService.getSellerBids(seller.getEmail(), auction.getId()))
                .filteredOn(entry -> "OUTBID".equals(entry.getStatus()))
                .allSatisfy(entry -> assertThat(entry.getAmount())
                        .isLessThanOrEqualTo(new BigDecimal("7100")));
    }

    /**
     * Re-pricing re-saves every bid row, so {@code updatedAt} moves for reasons unrelated to the
     * customer. A bidder who never raised their ceiling must not be shown as having raised it.
     */
    @Test
    void onlyABidderWhoActuallyRaisedTheirCeilingIsMarkedAsRevised() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);

        // A places once and is overtaken; B places once and then raises its own ceiling.
        bid(a, createAddress(a), auction, new BigDecimal("6000"));
        bid(b, createAddress(b), auction, new BigDecimal("6000"));
        bid(b, createAddress(b), auction, new BigDecimal("7000"));

        var sellerBids = biddingService.getSellerBids(seller.getEmail(), auction.getId());

        assertThat(sellerBids)
                .filteredOn(entry -> entry.getBidderEmail().equals(b.getEmail()))
                .allSatisfy(entry -> assertThat(entry.isRevised())
                        .as("B raised its ceiling, so the seller should see that")
                        .isTrue());
        assertThat(sellerBids)
                .filteredOn(entry -> entry.getBidderEmail().equals(a.getEmail()))
                .allSatisfy(entry -> assertThat(entry.isRevised())
                        .as("A was overtaken but never raised, which is not a raise")
                        .isFalse());
    }

    /** Raising a ceiling must not move the tie-break timestamp, or a tie would be decided by noise. */
    @Test
    void raisingACeilingLeavesTheTieBreakTimestampAlone() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);

        bid(a, createAddress(a), auction, new BigDecimal("6000"));
        var bBid = bid(b, createAddress(b), auction, new BigDecimal("6000"));
        assertThat(reload(auction.getId()).getLeadingBidder().getId())
                .as("A placed first, so A wins an exact tie")
                .isEqualTo(a.getId());

        // B matches A exactly but placed later, so A still leads.
        bid(b, createAddress(b), auction, new BigDecimal("6500"));
        assertThat(reload(auction.getId()).getLeadingBidder().getId())
                .as("B is ahead on ceiling, so B now leads despite placing later")
                .isEqualTo(b.getId());
        assertThat(bBid.getPlacedAt()).isNotNull();
    }

    /**
     * A bidder who is not leading was stamped with the amount it would take to take the lead - which
     * is by definition more than they authorised. On the public ladder that put losing bids above
     * the leader, so the page showed the wrong customer as the high bidder.
     */
    @Test
    void anOutbidBidderIsNeverCommittedToMoreThanTheirOwnCeiling() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        User c = createUser("c", Role.ROLE_CUSTOMER);

        bid(a, createAddress(a), auction, new BigDecimal("8000"));
        bid(b, createAddress(b), auction, new BigDecimal("6000"));
        bid(c, createAddress(c), auction, new BigDecimal("7000"));

        assertThat(biddingService.getMyBid(b.getEmail(), auction.getId()).getEffectiveBid())
                .as("B authorised 6000 and is not leading, so 6000 is the most they are committed to")
                .isEqualByComparingTo(new BigDecimal("6000"));
        assertThat(biddingService.getMyBid(c.getEmail(), auction.getId()).getEffectiveBid())
                .isEqualByComparingTo(new BigDecimal("7000"));
    }

    /** The ladder itself must never show a losing bid above the bid that is actually leading. */
    @Test
    void thePublicLadderNeverShowsALosingBidAboveTheLeader() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        User c = createUser("c", Role.ROLE_CUSTOMER);

        bid(a, createAddress(a), auction, new BigDecimal("8000"));
        bid(b, createAddress(b), auction, new BigDecimal("6000"));
        bid(c, createAddress(c), auction, new BigDecimal("7000"));

        var history = biddingService.getBidHistory(auction.getId());
        var leading = history.stream().filter(entry -> entry.isLeading()).findFirst().orElseThrow();

        assertThat(history)
                .as("a losing bid displayed above the leader is what made the page look broken")
                .allSatisfy(entry -> {
                    if (!entry.isLeading()) {
                        assertThat(entry.getAmount())
                                .isLessThanOrEqualTo(leading.getAmount());
                    }
                });
        assertThat(leading.getAmount())
                .as("A leads at the runner-up's 7000 plus one increment")
                .isEqualByComparingTo(new BigDecimal("7100"));
    }

    /** The highest ceiling must lead, and the price must never sit above what it authorised. */
    @Test
    void theHighestAuthorisedBidderAlwaysLeads() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        User c = createUser("c", Role.ROLE_CUSTOMER);

        // Bid in an order that does not match the ranking, so a price-driven bug cannot hide.
        bid(b, createAddress(b), auction, new BigDecimal("6000"));
        bid(c, createAddress(c), auction, new BigDecimal("9000"));
        bid(a, createAddress(a), auction, new BigDecimal("7000"));

        Auction running = reload(auction.getId());
        assertThat(running.getLeadingBidder().getId())
                .as("C authorised the most, so C must lead")
                .isEqualTo(c.getId());
        assertThat(running.getCurrentPrice())
                .as("7000 (the runner-up) + 100, well under C's 9000")
                .isEqualByComparingTo(new BigDecimal("7100"));
        assertThat(running.getCurrentPrice())
                .isLessThan(new BigDecimal("9000"));
    }

    /** A leading bid is committed to the same figure now as it will be charged at the close. */
    @Test
    void aWinningBidsCommittedAmountEqualsThePriceItWillPay() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);

        bid(a, createAddress(a), auction, new BigDecimal("8000"));
        bid(b, createAddress(b), auction, new BigDecimal("6000"));

        Auction running = reload(auction.getId());
        var aView = biddingService.getMyBid(a.getEmail(), auction.getId());

        assertThat(aView.isWinning()).isTrue();
        assertThat(aView.getEffectiveBid())
                .as("the running price and the committed amount must not disagree")
                .isEqualByComparingTo(running.getCurrentPrice());
        assertThat(aView.getEffectiveBid())
                .as("A is never charged anywhere near their 8000 ceiling")
                .isLessThan(new BigDecimal("8000"));
    }

    // ----- Seller visibility ---------------------------------------------------------------------

    /**
     * A seller has to be able to see who bid and what each bid is committed to; the anonymous public
     * ladder cannot answer either question while an auction is running.
     */
    @Test
    void aSellerSeesWhoBidWhatEachBidIsCommittedToAndWhichOneLeads() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);

        bid(a, createAddress(a), auction, new BigDecimal("8000"));
        bid(b, createAddress(b), auction, new BigDecimal("6000"));

        var sellerBids = biddingService.getSellerBids(seller.getEmail(), auction.getId());

        assertThat(sellerBids).hasSize(2);
        assertThat(sellerBids.get(0).isLeading())
                .as("the leading bid is the first row the seller reads")
                .isTrue();
        assertThat(sellerBids.get(0).getBidderEmail()).isEqualTo(a.getEmail());
        assertThat(sellerBids.get(0).getMaximumBid())
                .as("a seller running the lot needs the ceiling behind the price")
                .isEqualByComparingTo(new BigDecimal("8000"));
        assertThat(sellerBids.get(0).getAmount())
                .isEqualByComparingTo(new BigDecimal("6100"));
        assertThat(sellerBids.get(1).getBidderEmail()).isEqualTo(b.getEmail());
        assertThat(sellerBids.get(1).getStatus()).isEqualTo("OUTBID");
    }

    /** A withdrawn bid is hidden from the public ladder, but the seller still has to see it. */
    @Test
    void aSellerStillSeesABidTheCustomerWithdrew() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        User c = createUser("c", Role.ROLE_CUSTOMER);

        bid(a, createAddress(a), auction, new BigDecimal("8000"));
        bid(b, createAddress(b), auction, new BigDecimal("6000"));
        var cBid = bid(c, createAddress(c), auction, new BigDecimal("7000"));

        biddingService.withdrawBid(c.getEmail(), cBid.getId(), "changed my mind");

        assertThat(biddingService.getBidHistory(auction.getId()))
                .as("the public ladder hides a withdrawn bid")
                .hasSize(2);
        assertThat(biddingService.getSellerBids(seller.getEmail(), auction.getId()))
                .as("the seller has to see that a bidder walked away")
                .hasSize(3)
                .anySatisfy(entry -> {
                    assertThat(entry.getStatus()).isEqualTo("CANCELLED");
                    assertThat(entry.getBidderEmail()).isEqualTo(c.getEmail());
                });
    }

    @Test
    void aSellerCannotReadTheBidsOnSomebodyElsesAuction() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        User other = createUser("other", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        bid(a, createAddress(a), auction, new BigDecimal("8000"));

        assertThatThrownBy(() -> biddingService.getSellerBids(other.getEmail(), auction.getId()))
                .hasMessageContaining("your own auctions");
    }

    /** The privileged seller view must not have leaked into any public projection. */
    @Test
    void noPublicResponseEverCarriesABidderIdentityOrACeiling() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        bid(a, createAddress(a), auction, new BigDecimal("8000"));
        bid(b, createAddress(b), auction, new BigDecimal("6000"));

        // Structural check: the public auction DTO has no field that could hold an identity or a
        // ceiling, so the exposure cannot come back through a mapping change.
        var publicFields = java.util.Arrays.stream(AuctionDto.class.getDeclaredFields())
                .map(java.lang.reflect.Field::getName)
                .map(name -> name.toLowerCase(java.util.Locale.ROOT))
                .toList();

        assertThat(publicFields)
                .as("no public auction field may carry a bidder identity")
                .noneMatch(name -> name.contains("email") || name.contains("biddername")
                        || name.contains("bidderemail") || name.contains("leadingbidder"));
        assertThat(publicFields)
                .as("no public auction field may carry a ceiling")
                .noneMatch(name -> name.contains("maximum") || name.contains("ceiling"));

        // Behavioural check: the ladder is anonymous and quotes no ceiling.
        var history = biddingService.getBidHistory(auction.getId());
        assertThat(history).allSatisfy(entry -> {
            assertThat(entry.getBidderAlias()).startsWith("Bidder #");
            assertThat(entry.getBidderAlias()).doesNotContain("@");
            assertThat(entry.getAmount()).isNotEqualByComparingTo(new BigDecimal("8000"));
        });
    }

    // ----- Helpers ----------------------------------------------------------------------------

    private boolean bViewIsOutbid(User user, Auction auction) {
        return !biddingService.getMyBid(user.getEmail(), auction.getId()).isWinning();
    }
}
