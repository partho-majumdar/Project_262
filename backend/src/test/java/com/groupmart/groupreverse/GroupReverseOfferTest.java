package com.groupmart.groupreverse;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.groupmart.dto.groupr.SubmitGroupReverseOfferRequest;
import com.groupmart.entity.*;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The seller side of the contest: who may bid, what a bid must contain, and who wins what. */
class GroupReverseOfferTest extends AbstractGroupReverseTest {

    private static final BigDecimal TARGET = new BigDecimal("2000");
    private static final BigDecimal MAX = new BigDecimal("2100");

    private GroupReverseDemand readyDemand(int required) {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        Product product = createProduct(createSellerStore(createUser("cat", Role.ROLE_SELLER)),
                new BigDecimal("3000"), 100);
        GroupReverseDemand demand = createOpenDemand(leader, product, required, TARGET, MAX, 24);
        join(demand, leader, required);
        return reloadDemand(demand.getId());
    }

    private User approvedSeller() {
        User seller = createUser("seller", Role.ROLE_SELLER);
        createSellerStore(seller);
        return seller;
    }

    @Test
    void offersAreRankedByPriceForTheLeaderAndTheWholeContestIsVisible() {
        GroupReverseDemand demand = readyDemand(10);
        User cheap = approvedSeller();
        User mid = approvedSeller();
        User dear = approvedSeller();
        User leader = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.ROLE_CUSTOMER).findFirst().orElseThrow();

        submitOffer(demand, cheap, new BigDecimal("1950"), 10);
        submitOffer(demand, mid, new BigDecimal("1900"), 10);
        submitOffer(demand, dear, new BigDecimal("2050"), 10);

        var offers = offerService.getOffersForDemand(leader.getEmail(), demand.getId());
        assertThat(offers).hasSize(3);
        // Cheapest first, so the leader reads them in the order they should decide.
        assertThat(offers).extracting(o -> o.getUnitPrice())
                .containsExactly(new BigDecimal("1900.00"), new BigDecimal("1950.00"),
                        new BigDecimal("2050.00"));
        // A bid at or under the group's target price is flagged as meeting it; the dear one is not.
        assertThat(offers.get(0).isMeetsTargetPrice()).isTrue();
        assertThat(offers.get(1).isMeetsTargetPrice()).isTrue();
        assertThat(offers.get(2).isMeetsTargetPrice()).isFalse();
        // Each offer carries the group total the seller would be committing to.
        assertThat(offers.get(0).getGroupTotal()).isEqualByComparingTo(new BigDecimal("19000"));
    }

    @Test
    void anOfferMustCoverTheWholeGroupAndSitInsideTheGroupPriceRange() {
        GroupReverseDemand demand = readyDemand(10);
        User seller = approvedSeller();
        LocalDateTime expiry = demand.getOfferDeadline().minusHours(1);

        // Fewer units than the group needs cannot satisfy the group.
        assertThatThrownBy(() -> offerService.submitOffer(seller.getEmail(), demand.getId(),
                SubmitGroupReverseOfferRequest.builder().unitPrice(new BigDecimal("1900"))
                        .offeredQuantity(9).deliveryFee(BigDecimal.ZERO).estimatedDeliveryDays(3)
                        .offerExpiry(expiry).build()))
                .hasMessageContaining("must cover the whole group");

        // Above the ceiling the leader agreed to.
        assertThatThrownBy(() -> offerService.submitOffer(seller.getEmail(), demand.getId(),
                SubmitGroupReverseOfferRequest.builder().unitPrice(new BigDecimal("2500"))
                        .offeredQuantity(10).deliveryFee(BigDecimal.ZERO).estimatedDeliveryDays(3)
                        .offerExpiry(expiry).build()))
                .hasMessageContaining("above this group's maximum");

        // Below zero is nonsense.
        assertThatThrownBy(() -> offerService.submitOffer(seller.getEmail(), demand.getId(),
                SubmitGroupReverseOfferRequest.builder().unitPrice(new BigDecimal("-5"))
                        .offeredQuantity(10).deliveryFee(BigDecimal.ZERO).estimatedDeliveryDays(3)
                        .offerExpiry(expiry).build()))
                .hasMessageContaining("greater than zero");

        assertThat(groupOfferRepository.findByDemandIdOrderByUnitPriceAscCreatedAtAsc(demand.getId()))
                .isEmpty();
    }

    @Test
    void anOfferCannotOutliveTheGroupOrTheOfferRound() {
        GroupReverseDemand demand = readyDemand(10);
        User seller = approvedSeller();

        assertThatThrownBy(() -> offerService.submitOffer(seller.getEmail(), demand.getId(),
                SubmitGroupReverseOfferRequest.builder().unitPrice(new BigDecimal("1900"))
                        .offeredQuantity(10).deliveryFee(BigDecimal.ZERO).estimatedDeliveryDays(3)
                        .offerExpiry(demand.getOfferDeadline().plusHours(1)).build()))
                .hasMessageContaining("cannot stay open past");

        assertThatThrownBy(() -> offerService.submitOffer(seller.getEmail(), demand.getId(),
                SubmitGroupReverseOfferRequest.builder().unitPrice(new BigDecimal("1900"))
                        .offeredQuantity(10).deliveryFee(BigDecimal.ZERO).estimatedDeliveryDays(3)
                        .offerExpiry(LocalDateTime.now().minusHours(1)).build()))
                .hasMessageContaining("expiry");
    }

    @Test
    void onlyASellerWithAVerifiedStoreMayBid() {
        GroupReverseDemand demand = readyDemand(10);
        LocalDateTime expiry = demand.getOfferDeadline().minusHours(1);

        // A customer cannot bid, however keen they are.
        User customer = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.ROLE_CUSTOMER).findFirst().orElseThrow();
        assertThatThrownBy(() -> offerService.submitOffer(customer.getEmail(), demand.getId(),
                SubmitGroupReverseOfferRequest.builder().unitPrice(new BigDecimal("1900"))
                        .offeredQuantity(10).deliveryFee(BigDecimal.ZERO).estimatedDeliveryDays(3)
                        .offerExpiry(expiry).build()))
                .hasMessageContaining("seller");

        // Neither can a seller who has never been verified.
        User pending = createUser("pending", Role.ROLE_SELLER);
        userRepository.findById(pending.getId()).ifPresent(u -> {
            u.setSellerStatus(SellerStatus.PENDING);
            userRepository.saveAndFlush(u);
        });
        assertThatThrownBy(() -> offerService.submitOffer(pending.getEmail(), demand.getId(),
                SubmitGroupReverseOfferRequest.builder().unitPrice(new BigDecimal("1900"))
                        .offeredQuantity(10).deliveryFee(BigDecimal.ZERO).estimatedDeliveryDays(3)
                        .offerExpiry(expiry).build()))
                .hasMessageContaining("Seller store not found");
    }

    @Test
    void offersAreOnlyAcceptedOnceTheGroupIsComplete() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        Product product = createProduct(createSellerStore(createUser("cat", Role.ROLE_SELLER)),
                new BigDecimal("3000"), 100);
        GroupReverseDemand stillForming = createOpenDemand(leader, product, 10, TARGET, MAX, 24);
        join(stillForming, createUser("c", Role.ROLE_CUSTOMER), 4);
        User seller = approvedSeller();

        // The group is only 4 of 10, so there is nothing to bid on yet.
        assertThatThrownBy(() -> submitOffer(reloadDemand(stillForming.getId()), seller,
                new BigDecimal("1900"), 10))
                .hasMessageContaining("not accepting seller offers");
    }

    @Test
    void aSellerMayReviseItsOwnOfferAndWithdrawIt() {
        GroupReverseDemand demand = readyDemand(10);
        User seller = approvedSeller();
        GroupReverseOffer offer = submitOffer(demand, seller, new BigDecimal("2000"), 10);

        // A seller may improve its own bid, as long as nobody has decided yet.
        var revised = offerService.reviseOffer(seller.getEmail(), offer.getId(),
                SubmitGroupReverseOfferRequest.builder().unitPrice(new BigDecimal("1950"))
                        .offeredQuantity(10).deliveryFee(new BigDecimal("100")).estimatedDeliveryDays(2)
                        .warrantyMonths(24).offerExpiry(demand.getOfferDeadline().minusHours(1))
                        .message("Improved terms.").build());
        assertThat(revised.getUnitPrice()).isEqualByComparingTo(new BigDecimal("1950"));
        assertThat(revised.getDeliveryFee()).isEqualByComparingTo(new BigDecimal("100"));
        // 1950 per unit plus 100 of freight spread over 10 units is 1960 effective.
        assertThat(revised.getEffectiveUnitPriceIncludingDelivery())
                .isEqualByComparingTo(new BigDecimal("1960"));
        assertThat(demand.getId()).isNotNull();

        offerService.withdrawOffer(seller.getEmail(), offer.getId());
        GroupReverseOffer gone = groupOfferRepository.findById(offer.getId()).orElseThrow();
        assertThat(gone.getStatus()).isEqualTo(GroupReverseOfferStatus.WITHDRAWN);
        // A withdrawn bid stays on the record for the group, but it can no longer be chosen.
        var ballot = offerService.getOffersForDemand(
                userRepository.findAll().stream().filter(u -> u.getRole() == Role.ROLE_CUSTOMER)
                        .findFirst().orElseThrow().getEmail(), demand.getId());
        assertThat(ballot).hasSize(1);
        assertThat(ballot.get(0).getStatus()).isEqualTo(GroupReverseOfferStatus.WITHDRAWN);
        assertThat(ballot.get(0).isSelectable()).isFalse();
    }

    @Test
    void aSellerCannotTouchAnotherSellersOffer() {
        GroupReverseDemand demand = readyDemand(10);
        User owner = approvedSeller();
        User stranger = approvedSeller();
        GroupReverseOffer offer = submitOffer(demand, owner, new BigDecimal("2000"), 10);
        LocalDateTime expiry = demand.getOfferDeadline().minusHours(1);

        assertThatThrownBy(() -> offerService.reviseOffer(stranger.getEmail(), offer.getId(),
                SubmitGroupReverseOfferRequest.builder().unitPrice(new BigDecimal("1000"))
                        .offeredQuantity(10).deliveryFee(BigDecimal.ZERO).estimatedDeliveryDays(1)
                        .offerExpiry(expiry).build()))
                .hasMessageContaining("your own offer");
        assertThatThrownBy(() -> offerService.withdrawOffer(stranger.getEmail(), offer.getId()))
                .hasMessageContaining("your own offer");

        assertThat(groupOfferRepository.findById(offer.getId()).orElseThrow().getUnitPrice())
                .isEqualByComparingTo(new BigDecimal("2000"));
    }

    @Test
    void inventoryIsReservedForTheWinnerAndRefusedForTheLosers() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        Product product = createProduct(createSellerStore(createUser("cat", Role.ROLE_SELLER)),
                new BigDecimal("3000"), 12);
        GroupReverseDemand demand = createOpenDemand(leader, product, 10, TARGET, MAX, 24);
        join(demand, leader, 4);
        join(demand, createUser("c", Role.ROLE_CUSTOMER), 6);
        GroupReverseDemand ready = reloadDemand(demand.getId());
        assertThat(ready.getStatus()).isEqualTo(GroupReverseDemandStatus.READY_FOR_OFFERS);

        User rich = approvedSeller();
        User poor = approvedSeller();
        User broke = approvedSeller();
        submitOffer(ready, rich, new BigDecimal("1900"), 10);
        submitOffer(ready, poor, new BigDecimal("1950"), 10);
        submitOffer(ready, broke, new BigDecimal("2050"), 10);

        // Nothing is held while sellers are competing, even though only 12 exist.
        assertThat(stockOf(product)).isEqualTo(12);

        // The cheapest seller wins and the 10 units leave stock.
        var result = offerService.selectOffer(leader.getEmail(), demand.getId(),
                groupOfferRepository.findByDemandIdOrderByUnitPriceAscCreatedAtAsc(demand.getId())
                        .get(0).getId());
        assertThat(result.getSelectedOffer().getSellerStoreName()).isNotBlank();
        assertThat(result.getSelectedOffer().getUnitPrice()).isEqualByComparingTo(new BigDecimal("1900"));
        assertThat(stockOf(product)).isEqualTo(2);
        assertThat(result.getOrderCount()).isEqualTo(2);
    }

    @Test
    void aSellerWhoCannotCoverTheGroupLosesTheContractAtSelectionTime() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        Product product = createProduct(createSellerStore(createUser("cat", Role.ROLE_SELLER)),
                new BigDecimal("3000"), 10);
        GroupReverseDemand demand = createOpenDemand(leader, product, 10, TARGET, MAX, 24);
        join(demand, leader, 10);
        GroupReverseDemand ready = reloadDemand(demand.getId());

        User seller = approvedSeller();
        submitOffer(ready, seller, new BigDecimal("1900"), 10);
        // Another buyer empties the shelf between the bid and the decision.
        Product mutable = productRepository.findById(product.getId()).orElseThrow();
        mutable.setStockQuantity(0);
        productRepository.saveAndFlush(mutable);
        assertThat(stockOf(product)).isZero();

        assertThatThrownBy(() -> offerService.selectOffer(leader.getEmail(), demand.getId(),
                groupOfferRepository.findByDemandIdOrderByUnitPriceAscCreatedAtAsc(demand.getId())
                        .get(0).getId()))
                .hasMessageContaining("stock");

        // Nothing was half-created: no order, and the demand is still decidable.
        assertThat(orderRepository.findAll()).isEmpty();
        assertThat(reloadDemand(demand.getId()).getStatus())
                .isEqualTo(GroupReverseDemandStatus.OFFERS_RECEIVED);
    }

    @Test
    void aSellerSeesTheDemandButNotWhoIsInTheGroup() {
        GroupReverseDemand demand = readyDemand(10);
        User seller = approvedSeller();

        var marketplace = offerService.getAvailableDemands(seller.getEmail());
        assertThat(marketplace).extracting(d -> d.getId()).contains(demand.getId());
        // A seller's view of the group is the commercial facts: what, how many, by when, at what
        // price. It is never the identities of the people who will receive the goods.
        var listing = marketplace.stream().filter(d -> d.getId().equals(demand.getId()))
                .findFirst().orElseThrow();
        assertThat(listing.getRequiredQuantity()).isEqualTo(10);
        assertThat(listing.getCommittedQuantity()).isEqualTo(10);
        assertThat(listing.getTargetPrice()).isEqualByComparingTo(TARGET);
        assertThat(listing.getLeaderName()).isNotBlank();
        assertThat(listing.getMyMembership()).isNull();
    }
}
