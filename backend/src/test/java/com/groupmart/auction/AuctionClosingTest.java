package com.groupmart.auction;

import java.math.BigDecimal;

import com.groupmart.entity.*;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Settling an auction: who wins, what they pay, what happens to the lot, and what everybody is told.
 * <p>
 * These are the paths where a private maximum could leak into a public price, where a reserve could
 * be quietly ignored, or where two concurrent closes could produce two winners.
 */
class AuctionClosingTest extends AbstractAuctionIntegrationTest {

    private static final BigDecimal START = new BigDecimal("5000");
    private static final BigDecimal INCREMENT = new BigDecimal("100");

    @Test
    void theWinnerPaysTheEnginePriceAndNeverTheirOwnCeiling() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        bid(a, createAddress(a), auction, new BigDecimal("8000"));
        bid(b, createAddress(b), auction, new BigDecimal("6000"));

        expire(auction);
        var closed = closingService.close(auction.getId(), null, false);

        // A bid 8000 against a ceiling of 6000, so the price is 6100 - not 8000, and not 6000.
        assertThat(closed.getStatus()).isEqualTo(AuctionStatus.SOLD);
        assertThat(closed.getFinalPrice()).isEqualByComparingTo(new BigDecimal("6100"));
        assertThat(closed.getCurrentPrice()).isEqualByComparingTo(new BigDecimal("6100"));

        Order order = orderRepository.findByAuctionId(auction.getId()).orElseThrow();
        assertThat(order.getUser().getId()).isEqualTo(a.getId());
        assertThat(order.getOrderType()).isEqualTo(OrderType.AUCTION);
        assertThat(order.getSubtotalAmount()).isEqualByComparingTo(new BigDecimal("6100"));
        assertThat(order.getTotalAmount()).isEqualByComparingTo(new BigDecimal("6100"));

        AuctionBid winnerBid = allBids(auction.getId()).stream()
                .filter(candidate -> candidate.getBidder().getId().equals(a.getId()))
                .findFirst().orElseThrow();
        assertThat(winnerBid.getStatus()).isEqualTo(AuctionBidStatus.WON);
        assertThat(winnerBid.getAmountPaid()).isEqualByComparingTo(new BigDecimal("6100"));
        assertThat(winnerBid.getMaximumBid()).isEqualByComparingTo(new BigDecimal("8000"));
    }

    @Test
    void theLosersAreMarkedLostAndNeverSeeTheWinnersCeiling() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        bid(a, createAddress(a), auction, new BigDecimal("8000"));
        bid(b, createAddress(b), auction, new BigDecimal("6000"));
        expire(auction);
        closingService.close(auction.getId(), null, false);

        AuctionBid loser = allBids(auction.getId()).stream()
                .filter(x -> x.getBidder().getId().equals(b.getId()))
                .findFirst().orElseThrow();
        assertThat(loser.getStatus()).isEqualTo(AuctionBidStatus.LOST);
        assertThat(loser.getOrderId()).isNull();
        assertThat(loser.getAmountPaid()).isNull();

        // The loser's own view is the only place their ceiling is ever visible, and it is theirs.
        var myBid = biddingService.getMyBid(b.getEmail(), auction.getId());
        assertThat(myBid.getMaximumBid()).isEqualByComparingTo(new BigDecimal("6000"));
        assertThat(myBid.isWinning()).isFalse();
    }

    @Test
    void aMetReserveSellsNormallyAndAnUnmetOneEndsWithNoSale() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction withReserve = createLiveAuction(seller.getEmail(), product, START, INCREMENT,
                new BigDecimal("7000"), 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        bid(a, createAddress(a), withReserve, new BigDecimal("6500"));
        expire(withReserve);
        var met = closingService.close(withReserve.getId(), null, false);

        // The public price is 5000, far below the 7000 reserve, but the bidder authorised 6500...
        // ...which is still short, so there is no sale and the reserve stays secret.
        Auction settled = reload(withReserve.getId());
        assertThat(settled.getStatus()).isEqualTo(AuctionStatus.RESERVE_NOT_MET);
        assertThat(settled.getCloseCode()).isEqualTo(AuctionCloseCode.RESERVE_NOT_MET);
        assertThat(settled.hasReserve()).isTrue();
        assertThat(settled.getWinnerOrderId()).isNull();
        assertThat(orderRepository.findByAuctionId(withReserve.getId())).isEmpty();
        // The public view admits a reserve exists without ever saying what it is.
        assertThat(met.getStatus()).isEqualTo(AuctionStatus.RESERVE_NOT_MET);
        assertThat(met.getFinalPrice()).isNull();
    }

    @Test
    void theReserveIsJudgedOnTheWinnersCeilingNotOnThePublicPrice() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT,
                new BigDecimal("6000"), 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        bid(a, createAddress(a), auction, new BigDecimal("9000"));
        bid(b, createAddress(b), auction, new BigDecimal("5500"));

        // The public price is 5600, under the 6000 reserve. A authorised 9000, so the sale happens -
        // and the seller still never discloses the 6000.
        assertThat(reload(auction.getId()).getCurrentPrice()).isEqualByComparingTo(new BigDecimal("5600"));
        expire(auction);
        var closed = closingService.close(auction.getId(), null, false);

        assertThat(closed.getStatus()).isEqualTo(AuctionStatus.SOLD);
        assertThat(closed.getFinalPrice()).isEqualByComparingTo(new BigDecimal("5600"));
        // The reserve itself is seller-only, so it appears in the seller's view and nowhere public.
        assertThat(closed.getFinalPrice()).isNotEqualTo(reload(auction.getId()).getReservePrice());
        assertThat(reload(auction.getId()).hasReserve()).isTrue();
        var sellerView = auctionService.getSellerAuction(seller.getEmail(), auction.getId());
        assertThat(sellerView.getReservePrice()).isEqualByComparingTo(new BigDecimal("6000"));
    }

    @Test
    void aSaleLessCloseReturnsTheLotToSellableStock() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        // One unit is held out of stock for the lot, leaving four sellable.
        assertThat(reloadProduct(product.getId()).getStockQuantity()).isEqualTo(4);

        expire(auction);
        var closed = closingService.close(auction.getId(), null, false);

        assertThat(closed.getStatus()).isEqualTo(AuctionStatus.ENDED);
        assertThat(reload(auction.getId()).getCloseCode())
                .isEqualTo(AuctionCloseCode.DEADLINE_REACHED_NO_BIDS);
        assertThat(reloadProduct(product.getId()).getStockQuantity()).isEqualTo(5);
        assertThat(orderRepository.findByAuctionId(auction.getId())).isEmpty();
    }

    @Test
    void aSoldLotIsNotReleasedBackIntoStock() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        bid(a, createAddress(a), auction, new BigDecimal("5100"));
        expire(auction);
        var closed = closingService.close(auction.getId(), null, false);

        // The unit was genuinely sold, so it must not reappear as sellable stock.
        // A lone bidder authorises 5100 but pays the 5000 opening price, and the unit is gone for good.
        assertThat(closed.getFinalPrice()).isEqualByComparingTo(START);
        assertThat(reloadProduct(product.getId()).getStockQuantity()).isEqualTo(4);
        assertThat(reload(auction.getId()).isInventoryReserved()).isFalse();
    }

    @Test
    void closingTwiceIsIdempotentAndYieldsExactlyOneOrder() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        bid(a, createAddress(a), auction, new BigDecimal("8000"));
        expire(auction);

        var first = closingService.close(auction.getId(), null, false);
        var second = closingService.close(auction.getId(), null, false);
        // The scheduler and the seller button racing is exactly this call happening twice.
        var third = closingService.close(auction.getId(), seller.getEmail(), true);

        assertThat(first.getStatus()).isEqualTo(AuctionStatus.SOLD);
        assertThat(second.getStatus()).isEqualTo(AuctionStatus.SOLD);
        assertThat(third.getStatus()).isEqualTo(AuctionStatus.SOLD);
        assertThat(third.getFinalPrice()).isEqualByComparingTo(first.getFinalPrice());
        assertThat(orderRepository.findByAuctionId(auction.getId())).isPresent();

        long winnerOrders = orderRepository.findAll().stream()
                .filter(o -> java.util.Objects.equals(o.getAuctionId(), auction.getId()))
                .count();
        assertThat(winnerOrders).isEqualTo(1);
    }

    @Test
    void aStillRunningAuctionCannotBeClosedByTheScheduler() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);

        assertThatThrownBy(() -> closingService.close(auction.getId(), null, false))
                .hasMessageContaining("still running");
        assertThat(reload(auction.getId()).getStatus()).isEqualTo(AuctionStatus.LIVE);
    }

    @Test
    void aSellerCannotCloseSomebodyElsesAuctionEarly() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);
        User stranger = createUser("stranger", Role.ROLE_SELLER);

        assertThatThrownBy(() -> closingService.close(auction.getId(), stranger.getEmail(), true))
                .hasMessageContaining("only close your own");
    }

    @Test
    void theOwningSellerMayCloseEarlyAndAnUnmetReserveStillBlocksTheSale() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT,
                new BigDecimal("9000"), 1, 60);

        User a = createUser("a", Role.ROLE_CUSTOMER);
        bid(a, createAddress(a), auction, new BigDecimal("8000"));

        var closed = closingService.close(auction.getId(), seller.getEmail(), true);
        assertThat(closed.getStatus()).isEqualTo(AuctionStatus.RESERVE_NOT_MET);
        assertThat(reloadProduct(product.getId()).getStockQuantity()).isEqualTo(5);
    }

    @Test
    void anAdminCancelReleasesTheLotAndTellsTheBidders() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);
        User a = createUser("a", Role.ROLE_CUSTOMER);
        bid(a, createAddress(a), auction, new BigDecimal("8000"));
        User admin = createUser("admin", Role.ROLE_ADMIN);

        var cancelled = closingService.cancelByAdmin(auction.getId(), admin.getEmail(), "Prohibited item");

        assertThat(cancelled.getStatus()).isEqualTo(AuctionStatus.CANCELLED);
        assertThat(reload(auction.getId()).getCloseCode()).isEqualTo(AuctionCloseCode.CANCELLED_BY_ADMIN);
        assertThat(reloadProduct(product.getId()).getStockQuantity()).isEqualTo(5);
        assertThat(orderRepository.findByAuctionId(auction.getId())).isEmpty();
        assertThat(allBids(auction.getId()).get(0).getStatus()).isEqualTo(AuctionBidStatus.LOST);
        assertThat(notificationRepository.findByUserIdOrderByCreatedAtDesc(a.getId()))
                .anyMatch(n -> n.getMessage().contains("Prohibited item"));
    }

    @Test
    void aCustomerCannotCancelAnAuction() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);
        User customer = createUser("customer", Role.ROLE_CUSTOMER);

        assertThatThrownBy(() -> closingService.cancelByAdmin(auction.getId(), customer.getEmail(), "because"))
                .hasMessageContaining("administrator");
    }

    @Test
    void theWinnerAndTheSellerAreBothNotifiedWithTheOrderNumber() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);
        User a = createUser("a", Role.ROLE_CUSTOMER);
        bid(a, createAddress(a), auction, new BigDecimal("8000"));
        expire(auction);

        closingService.close(auction.getId(), null, false);
        Order order = orderRepository.findByAuctionId(auction.getId()).orElseThrow();

        var winnerNotes = notificationRepository.findByUserIdOrderByCreatedAtDesc(a.getId());
        assertThat(winnerNotes).anyMatch(n -> n.getTitle().contains("won the auction"));
        assertThat(winnerNotes).anyMatch(n -> n.getMessage().contains(order.getOrderNumber()));

        var sellerNotes = notificationRepository.findByUserIdOrderByCreatedAtDesc(seller.getId());
        assertThat(sellerNotes).anyMatch(n -> n.getTitle().contains("sold"));
        assertThat(sellerNotes).anyMatch(n -> n.getMessage().contains(order.getOrderNumber()));
    }

    @Test
    void aLosersNotificationNeverQuotesTheWinnersCeiling() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        Product product = createProduct(createSellerStore(seller), new BigDecimal("20000"), 5);
        Auction auction = createLiveAuction(seller.getEmail(), product, START, INCREMENT, null, 1, 60);
        User a = createUser("a", Role.ROLE_CUSTOMER);
        User b = createUser("b", Role.ROLE_CUSTOMER);
        bid(a, createAddress(a), auction, new BigDecimal("8000"));
        bid(b, createAddress(b), auction, new BigDecimal("6000"));
        expire(auction);
        closingService.close(auction.getId(), null, false);

        for (var note : notificationRepository.findByUserIdOrderByCreatedAtDesc(b.getId())) {
            assertThat(note.getMessage()).doesNotContain("8000");
        }
    }
}
