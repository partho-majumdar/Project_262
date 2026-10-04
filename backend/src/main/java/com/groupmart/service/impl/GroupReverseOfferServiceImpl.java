package com.groupmart.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.groupr.*;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.realtime.RealtimePublisher;
import com.groupmart.realtime.RealtimeTopics;
import com.groupmart.service.GroupReverseOfferService;
import com.groupmart.service.NotificationService;

/**
 * The competitive seller round and the leader's selection of a winner.
 * <p>
 * <b>Nobody is auto-selected.</b> Offers are stored side by side and returned as plain facts; the
 * cheapest one gets no special treatment, and nothing here picks a winner. The only path to a locked
 * price is {@link #selectOffer}, which only the demand's creator may call.
 * <p>
 * <b>Inventory is taken at selection, not at submission.</b> A bid costs a seller nothing to place,
 * so the stock check happens when the leader commits - and it is an atomic conditional decrement, so
 * a group of fifty can never be confirmed against a product that only has thirty units.
 * <p>
 * <b>Selection is idempotent under concurrency.</b> The demand row is locked before the state is
 * read, so two simultaneous selections cannot both proceed, and {@code orders.group_reverse_member_id}
 * is unique so a retried pass cannot give one member two orders.
 */
@Service
@RequiredArgsConstructor
public class GroupReverseOfferServiceImpl implements GroupReverseOfferService {

    private static final String NOTIFICATION_TYPE = "GROUP_REVERSE";
    private static final String ORDER_NUMBER_TAG = "GRVS";

    private final GroupReverseDemandRepository demandRepository;
    private final GroupReverseOfferRepository offerRepository;
    private final GroupReverseMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final SellerStoreRepository sellerStoreRepository;
    private final ProductRepository productRepository;
    private final ReservedStockManager stockManager;
    private final CollectiveOrderFactory orderFactory;
    private final OrderRepository orderRepository;
    private final NotificationService notificationService;
    private final GroupReverseMapper mapper;
    private final RealtimePublisher realtimePublisher;

    @Override
    @Transactional
    public GroupReverseOfferDto submitOffer(String sellerEmail, UUID demandId,
                                            SubmitGroupReverseOfferRequest request) {
        SellerStore store = requireApprovedSellerStore(sellerEmail);
        GroupReverseDemand demand = demandRepository.findById(demandId)
                .orElseThrow(() -> new ResourceNotFoundException("Group demand", "id", demandId));
        LocalDateTime now = LocalDateTime.now();

        if (!demand.getStatus().acceptsOffers()) {
            throw bad("This group demand is not accepting seller offers right now (status: "
                    + demand.getStatus().name().replace('_', ' ') + ").");
        }
        if (!demand.getOfferDeadline().isAfter(now)) {
            throw bad("The offer deadline for this group has passed.");
        }
        validateOfferTerms(demand, request, now);

        GroupReverseOffer offer = GroupReverseOffer.builder()
                .demand(demand)
                .sellerStore(store)
                .unitPrice(request.getUnitPrice())
                .offeredQuantity(request.getOfferedQuantity())
                .deliveryFee(request.getDeliveryFee() == null ? BigDecimal.ZERO : request.getDeliveryFee())
                .estimatedDeliveryDays(request.getEstimatedDeliveryDays())
                .warrantyMonths(request.getWarrantyMonths())
                .message(request.getMessage())
                // An offer can never outlive the demand's own offer deadline.
                .offerExpiry(minOf(request.getOfferExpiry(), demand.getOfferDeadline()))
                .status(GroupReverseOfferStatus.SUBMITTED)
                .build();
        GroupReverseOffer saved = offerRepository.save(offer);

        demand.setOfferCount(offerRepository.findByDemandIdAndStatus(demandId,
                GroupReverseOfferStatus.SUBMITTED).size());
        // The first offer is what turns "ready for offers" into "offers received" for the leader's UI.
        if (demand.getStatus() == GroupReverseDemandStatus.READY_FOR_OFFERS) {
            demand.setStatus(GroupReverseDemandStatus.OFFERS_RECEIVED);
        }
        demandRepository.save(demand);

        notify(demand.getLeader(), "A seller bid on your group demand",
                "'" + shortText(demand.getProduct().getName(), 60) + "': " + store.getStoreName()
                        + " offered " + request.getUnitPrice() + " per unit for all "
                        + demand.getRequiredQuantity() + " units.",
                "/group-reverse-demands/" + demandId + "/offers");
        return mapper.toOfferDto(saved, now);
    }

    @Override
    @Transactional
    public GroupReverseOfferDto reviseOffer(String sellerEmail, UUID offerId,
                                            SubmitGroupReverseOfferRequest request) {
        SellerStore store = requireApprovedSellerStore(sellerEmail);
        GroupReverseOffer offer = requireOwnOffer(store, offerId);
        LocalDateTime now = LocalDateTime.now();

        if (offer.getStatus() != GroupReverseOfferStatus.SUBMITTED) {
            throw bad("This offer is already " + offer.getStatus().name().toLowerCase()
                    + " and can no longer be changed.");
        }
        if (!offer.getDemand().getOfferDeadline().isAfter(now)) {
            throw bad("The offer deadline for this group has passed.");
        }
        validateOfferTerms(offer.getDemand(), request, now);

        offer.setUnitPrice(request.getUnitPrice());
        offer.setOfferedQuantity(request.getOfferedQuantity());
        offer.setDeliveryFee(request.getDeliveryFee() == null ? BigDecimal.ZERO : request.getDeliveryFee());
        offer.setEstimatedDeliveryDays(request.getEstimatedDeliveryDays());
        offer.setWarrantyMonths(request.getWarrantyMonths());
        offer.setMessage(request.getMessage());
        offer.setOfferExpiry(minOf(request.getOfferExpiry(), offer.getDemand().getOfferDeadline()));
        return mapper.toOfferDto(offerRepository.save(offer), now);
    }

    @Override
    @Transactional
    public GroupReverseOfferDto withdrawOffer(String sellerEmail, UUID offerId) {
        SellerStore store = requireApprovedSellerStore(sellerEmail);
        GroupReverseOffer offer = requireOwnOffer(store, offerId);
        if (offer.getStatus() == GroupReverseOfferStatus.ACCEPTED) {
            throw bad("This offer was selected, so it cannot be withdrawn. The group is now committed "
                    + "and any change has to go through the order.");
        }
        if (offer.getStatus() != GroupReverseOfferStatus.SUBMITTED) {
            return mapper.toOfferDto(offer, LocalDateTime.now());
        }
        offer.setStatus(GroupReverseOfferStatus.WITHDRAWN);
        offer.setClosedAt(LocalDateTime.now());
        offer.setCloseNote("Withdrawn by the seller");
        return mapper.toOfferDto(offerRepository.save(offer), LocalDateTime.now());
    }

    @Override
    @Transactional(readOnly = true)
    public List<GroupReverseOfferDto> getOffersForDemand(String requesterEmail, UUID demandId) {
        GroupReverseDemand demand = demandRepository.findById(demandId)
                .orElseThrow(() -> new ResourceNotFoundException("Group demand", "id", demandId));
        User requester = requireUser(requesterEmail);
        boolean isLeader = demand.getLeader().getId().equals(requester.getId());

        // Competing offers are commercially sensitive: only the creator, who has to choose between
        // them, may read them. A plain member is not privy to what the alternative sellers bid.
        if (!isLeader) {
            throw new ApiException("Only the demand creator can review the seller offers",
                    HttpStatus.FORBIDDEN);
        }
        LocalDateTime now = LocalDateTime.now();
        return offerRepository.findByDemandIdOrderByUnitPriceAscCreatedAtAsc(demandId).stream()
                .map(offer -> mapper.toOfferDto(offer, now))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<GroupReverseOfferDto> getMyOffers(String sellerEmail) {
        SellerStore store = requireApprovedSellerStore(sellerEmail);
        LocalDateTime now = LocalDateTime.now();
        return offerRepository.findBySellerStoreIdOrderByCreatedAtDesc(store.getId()).stream()
                .map(offer -> mapper.toOfferDto(offer, now))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<GroupReverseDemandDto> getAvailableDemands(String sellerEmail) {
        SellerStore store = requireApprovedSellerStore(sellerEmail);
        LocalDateTime now = LocalDateTime.now();
        return demandRepository.findByStatusInOrderByCreatedAtDesc(List.of(
                        GroupReverseDemandStatus.READY_FOR_OFFERS,
                        GroupReverseDemandStatus.OFFERS_RECEIVED))
                .stream()
                .filter(demand -> demand.getOfferDeadline().isAfter(now))
                .map(demand -> mapper.toDemandDto(demand, now))
                .toList();
    }

    @Override
    @Transactional
    public GroupReverseSelectionResultDto selectOffer(String leaderEmail, UUID demandId, UUID offerId) {
        // Lock the demand first: this makes two concurrent selections serialise, so the second one
        // observes an already-locked status and refuses instead of pricing the group twice.
        GroupReverseDemand demand = demandRepository.findByIdForUpdate(demandId)
                .orElseThrow(() -> new ResourceNotFoundException("Group demand", "id", demandId));
        LocalDateTime now = LocalDateTime.now();

        if (!demand.getLeader().getId().equals(requireUser(leaderEmail).getId())) {
            throw new ApiException("Only the demand creator can select a seller offer",
                    HttpStatus.FORBIDDEN);
        }
        if (demand.getStatus().isLocked()) {
            if (demand.getSelectedOffer() != null
                    && demand.getSelectedOffer().getId().equals(offerId)) {
                // Re-selecting the same offer is a no-op rather than an error, so a double-click is
                // harmless.
                return buildResult(demand, demand.getSelectedOffer(), List.of(), now,
                        "This offer was already selected.");
            }
            throw bad("A seller has already been selected for this group.");
        }
        if (!demand.getStatus().acceptsOffers()) {
            throw bad("This group demand is not in the offer round (status: "
                    + demand.getStatus().name().replace('_', ' ') + ").");
        }
        if (!demand.getOfferDeadline().isAfter(now)) {
            throw bad("The offer deadline has passed, so no offer can be selected.");
        }

        GroupReverseOffer offer = offerRepository.findByIdAndDemandId(offerId, demandId)
                .orElseThrow(() -> new ResourceNotFoundException("Offer", "id", offerId));
        if (!offer.isSelectable(now)) {
            throw bad("That offer is " + offer.getStatus().name().toLowerCase()
                    + " and can no longer be selected.");
        }
        if (offer.getOfferedQuantity() < demand.getRequiredQuantity()) {
            throw bad("That offer only covers " + offer.getOfferedQuantity() + " of the "
                    + demand.getRequiredQuantity() + " units the group needs.");
        }

        // Take the whole group quantity out of stock before promising a single unit. This is the
        // conditional decrement, so two demands racing for the same last units cannot both win.
        Product product = demand.getProduct();
        stockManager.reserve(product, offer.getSellerStore(), demand.getCommittedQuantity(),
                "GROUP_REVERSE_ACCEPTED", "GRVDEMAND:" + demandId);

        // Freeze the commercial terms. Nothing below this line ever recalculates them.
        demand.setSelectedOffer(offer);
        demand.setLockedUnitPrice(offer.getUnitPrice());
        demand.setLockedDeliveryFee(offer.getDeliveryFee());
        demand.setLockedEstimatedDeliveryDays(offer.getEstimatedDeliveryDays());
        demand.setLockedWarrantyMonths(offer.getWarrantyMonths());
        demand.setOfferSelectedAt(now);
        demand.setStatus(GroupReverseDemandStatus.OFFER_SELECTED);

        offer.setStatus(GroupReverseOfferStatus.ACCEPTED);
        offer.setClosedAt(now);
        offer.setCloseNote("Selected by the demand creator");
        offerRepository.save(offer);

        // Every other bid loses. Told plainly, without revealing the price that beat them.
        for (GroupReverseOffer other : offerRepository.findByDemandIdAndStatus(demandId,
                GroupReverseOfferStatus.SUBMITTED)) {
            other.setStatus(GroupReverseOfferStatus.CLOSED);
            other.setClosedAt(now);
            other.setCloseNote("Another seller was selected for this group");
            offerRepository.save(other);
            if (other.getSellerStore().getUser() != null) {
                notify(other.getSellerStore().getUser(), "Your group offer was not selected",
                        "The group demand you bid on went to another seller. Thank you for bidding.",
                        "/seller/dashboard?tab=group-reverse");
            }
        }
        notify(offer.getSellerStore().getUser(), "You won the group order",
                "You were selected to supply " + demand.getCommittedQuantity() + " units of '"
                        + shortText(product.getName(), 60) + "' at " + offer.getUnitPrice()
                        + " per unit. The members' orders are now being created.",
                "/seller/dashboard?tab=group-reverse");

        // One individual order per member, at the locked price, to that member's own address.
        List<GroupReverseSelectionResultDto.GeneratedOrder> created = generateMemberOrders(demand, offer, now);
        demand.setStatus(GroupReverseDemandStatus.ORDERS_CREATED);
        demand.setOrdersCreatedAt(now);
        GroupReverseDemand saved = demandRepository.save(demand);

        // The three sides of this decision are all looking at different screens, so each is told
        // about the one thing only they can act on: the winner has orders to fulfil, the sellers
        // who lost have a closed bid, and anyone watching the group sees it committed.
        announceSelectionToSellers(saved, offer);
        realtimePublisher.storefrontChanged("group-reverse-demand", saved.getId(),
                "A seller was selected for a group");

        return buildResult(saved, offer, created, now,
                "Seller selected. Each member now has their own order to pay for.");
    }

    /** Tells the winning and losing sellers, and nobody else's, what the decision was. */
    private void announceSelectionToSellers(GroupReverseDemand demand, GroupReverseOffer winner) {
        String summary = "A group demand selected an offer";
        realtimePublisher.userChanged(RealtimeTopics.SELLER_ACCOUNT, "group-reverse-demand",
                demand.getId(), winner.getSellerStore().getUser().getEmail(),
                "Your offer was selected - " + demand.getCommittedQuantity() + " unit(s) to supply");
        for (GroupReverseOffer other : offerRepository.findByDemandIdAndStatus(demand.getId(),
                GroupReverseOfferStatus.CLOSED)) {
            if (other.getSellerStore() != null && other.getSellerStore().getUser() != null) {
                realtimePublisher.userChanged(RealtimeTopics.SELLER_ACCOUNT, "group-reverse-demand",
                        demand.getId(), other.getSellerStore().getUser().getEmail(), summary);
            }
        }
    }

    // ---- The fan-out into individual orders ---------------------------------------------------------

    /**
     * Creates one order per member at the locked price.
     * <p>
     * This is the point of the whole mechanism: collective to establish the purchasing power,
     * individual from here on. Each member gets their own order number, their own payment, their own
     * address and their own shipment. Nothing is merged, and no member - least of all the leader -
     * carries anybody else's quantity.
     */
    private List<GroupReverseSelectionResultDto.GeneratedOrder> generateMemberOrders(
            GroupReverseDemand demand, GroupReverseOffer offer, LocalDateTime now) {

        List<GroupReverseMember> members = memberRepository
                .findByDemandIdAndStatus(demand.getId(), GroupReverseMemberStatus.JOINED);
        BigDecimal deliveryFee = offer.getDeliveryFee() == null ? BigDecimal.ZERO : offer.getDeliveryFee();
        int memberCount = members.size();
        List<GroupReverseSelectionResultDto.GeneratedOrder> created = new ArrayList<>();

        BigDecimal feeLeft = deliveryFee;
        for (int i = 0; i < members.size(); i++) {
            GroupReverseMember member = members.get(i);

            // The seller-committed delivery charge is split across the group, with the rounding
            // remainder left on the last member so the parts sum exactly to the agreed total.
            BigDecimal share;
            if (i == members.size() - 1) {
                share = feeLeft;
            } else {
                share = deliveryFee.divide(BigDecimal.valueOf(memberCount), 2, RoundingMode.HALF_UP);
                feeLeft = feeLeft.subtract(share);
            }

            member.setStatus(GroupReverseMemberStatus.CONFIRMED);
            member.setLockedUnitPrice(offer.getUnitPrice());
            member.setLockedDeliveryFee(deliveryFee);
            member.setDeliveryFeeShare(share);

            Order order = orderFactory.createIndividualOrder(
                    ORDER_NUMBER_TAG,
                    OrderType.GROUP_REVERSE_BUYING,
                    demand.getProduct(),
                    offer.getSellerStore(),
                    member.getCustomer(),
                    member.getRequestedQuantity(),
                    offer.getUnitPrice(),
                    new ShippingSnapshot(
                            member.getShippingAddressLine1(),
                            member.getShippingAddressLine2(),
                            member.getShippingCity(),
                            member.getShippingState(),
                            member.getShippingPostalCode(),
                            member.getShippingCountry()),
                    member.getPaymentMethod(),
                    CollectiveOrderFactory.paymentReference("grvm" + member.getId().toString()
                            .substring(0, 8)),
                    "Group demand " + demand.getId() + " at " + offer.getUnitPrice() + " per unit");

            // Traceability back to the group, plus the unique member link that makes a duplicate
            // order impossible even if this pass were somehow run twice.
            order.setGroupReverseDemandId(demand.getId());
            order.setGroupReverseMemberId(member.getId());
            order.setGroupReverseStoreId(offer.getSellerStore().getId());
            Order savedOrder = orderRepository.save(order);

            member.setOrder(savedOrder);
            member.setOrderNumber(savedOrder.getOrderNumber());
            member.setAmountPaid(savedOrder.getTotalAmount());
            member.setStatus(GroupReverseMemberStatus.ORDER_CREATED);
            memberRepository.save(member);

            created.add(GroupReverseSelectionResultDto.GeneratedOrder.builder()
                    .memberId(member.getId())
                    .customerId(member.getCustomer().getId())
                    .customerName(member.getCustomer().getFirstName() + " "
                            + member.getCustomer().getLastName())
                    .quantity(member.getRequestedQuantity())
                    .unitPrice(offer.getUnitPrice())
                    .deliveryFeeShare(share)
                    .total(savedOrder.getTotalAmount())
                    .orderId(savedOrder.getId())
                    .orderNumber(savedOrder.getOrderNumber())
                    .build());

            notify(member.getCustomer(), "Your group order is ready to pay",
                    "The group bought '" + shortText(demand.getProduct().getName(), 60)
                            + "' at " + offer.getUnitPrice() + " per unit. Your order for "
                            + member.getRequestedQuantity() + " unit(s) is " + savedOrder.getOrderNumber()
                            + ". Please complete payment.",
                    "/orders/confirmation/" + savedOrder.getOrderNumber());

            // Every member but the leader is sitting on some other page when this happens, so the
            // change interceptor - which only knows the person who clicked - cannot reach them.
            // Each of them has a brand new order to pay, so they are told directly.
            realtimePublisher.userChanged(RealtimeTopics.ORDERS, "order", savedOrder.getId(),
                    member.getCustomer().getEmail(),
                    "Your group order " + savedOrder.getOrderNumber() + " is ready to pay");
            realtimePublisher.userChanged(RealtimeTopics.GROUP_REVERSE, "group-reverse-demand",
                    demand.getId(), member.getCustomer().getEmail(),
                    "A seller was selected for your group");
        }
        return created;
    }

    private GroupReverseSelectionResultDto buildResult(GroupReverseDemand demand, GroupReverseOffer offer,
                                                      List<GroupReverseSelectionResultDto.GeneratedOrder> created,
                                                      LocalDateTime now, String note) {
        BigDecimal grandTotal = BigDecimal.ZERO;
        int units = 0;
        for (GroupReverseSelectionResultDto.GeneratedOrder order : created) {
            grandTotal = grandTotal.add(order.getTotal());
            units += order.getQuantity();
        }
        return GroupReverseSelectionResultDto.builder()
                .demand(mapper.toDemandDto(demand, now))
                .selectedOffer(mapper.toOfferDto(offer, now))
                .orders(created)
                .orderCount(created.size())
                .totalUnits(units)
                .grandTotal(grandTotal)
                .note(note)
                .build();
    }

    // ---- Validation ---------------------------------------------------------------------------------

    private void validateOfferTerms(GroupReverseDemand demand, SubmitGroupReverseOfferRequest request,
                                    LocalDateTime now) {
        if (request.getUnitPrice() == null || request.getUnitPrice().signum() <= 0) {
            throw bad("The unit price must be greater than zero.");
        }
        if (request.getOfferedQuantity() == null
                || request.getOfferedQuantity() < demand.getRequiredQuantity()) {
            throw bad("A group offer must cover the whole group: this demand needs "
                    + demand.getRequiredQuantity() + " unit(s).");
        }
        if (request.getDeliveryFee() != null && request.getDeliveryFee().signum() < 0) {
            throw bad("The delivery fee cannot be negative.");
        }
        if (request.getEstimatedDeliveryDays() == null || request.getEstimatedDeliveryDays() < 1) {
            throw bad("An estimated delivery time of at least one day is required.");
        }
        if (request.getWarrantyMonths() != null && request.getWarrantyMonths() < 0) {
            throw bad("The warranty cannot be negative.");
        }
        // Refuse above the creator's stated ceiling here rather than letting the leader be handed a
        // choice their own demand already rules out.
        if (demand.hasMaxPrice() && request.getUnitPrice().compareTo(demand.getMaxPrice()) > 0) {
            throw bad("Your price of " + request.getUnitPrice() + " is above this group's maximum of "
                    + demand.getMaxPrice() + ".");
        }
        if (request.getOfferExpiry() == null || !request.getOfferExpiry().isAfter(now)) {
            throw bad("The offer expiry must be in the future.");
        }
        // An offer may not stay open past the demand's own offer deadline, because a selection made
        // after that point would be unenforceable.
        if (request.getOfferExpiry().isAfter(demand.getOfferDeadline())) {
            throw bad("An offer cannot stay open past the group's own offer deadline of "
                    + demand.getOfferDeadline() + ".");
        }
    }

    private GroupReverseOffer requireOwnOffer(SellerStore store, UUID offerId) {
        GroupReverseOffer offer = offerRepository.findById(offerId)
                .orElseThrow(() -> new ResourceNotFoundException("Offer", "id", offerId));
        if (!offer.getSellerStore().getId().equals(store.getId())) {
            throw new ApiException("You can only change your own offers", HttpStatus.FORBIDDEN);
        }
        return offer;
    }

    private SellerStore requireApprovedSellerStore(String email) {
        User user = requireUser(email);
        if (user.getRole() != Role.ROLE_SELLER && user.getRole() != Role.ROLE_ADMIN) {
            throw new ApiException("Only a seller can submit a group offer", HttpStatus.FORBIDDEN);
        }
        SellerStore store = sellerStoreRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Seller store", "user", email));
        if (!store.isVerified()) {
            throw new ApiException("Your store must be verified before it can bid on group demands",
                    HttpStatus.FORBIDDEN);
        }
        return store;
    }

    private User requireUser(String email) {
        if (email == null) {
            throw new ApiException("You must be signed in", HttpStatus.UNAUTHORIZED);
        }
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    private static LocalDateTime minOf(LocalDateTime a, LocalDateTime b) {
        return a.isBefore(b) ? a : b;
    }

    private void notify(User recipient, String title, String message, String link) {
        if (recipient == null) {
            return;
        }
        notificationService.sendNotification(com.groupmart.dto.notification.SendNotificationRequest
                .builder()
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
        return text.length() <= max ? text : text.substring(0, max - 1) + "...";
    }

    private static ApiException bad(String message) {
        return new ApiException(message, HttpStatus.BAD_REQUEST);
    }
}
