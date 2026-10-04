package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.notification.SendNotificationRequest;
import com.groupmart.dto.order.OrderDto;
import com.groupmart.dto.wholesale.ReserveWholesaleQuantityRequest;
import com.groupmart.dto.wholesale.WholesalePoolDto;
import com.groupmart.dto.wholesale.WholesaleReservationDto;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.NotificationService;
import com.groupmart.service.OrderService;
import com.groupmart.service.WholesalePoolService;
import com.groupmart.service.WholesalePurchaseService;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static com.groupmart.service.impl.GroupBuyEventRecorder.money;

@Service
@RequiredArgsConstructor
public class WholesalePoolServiceImpl implements WholesalePoolService {

    private static final String SELLER_LINK = "/seller/dashboard?tab=wholesale";
    private static final String CUSTOMER_LINK = "/orders";

    // Notify the seller once pooled quantity reaches this fraction of the wholesale minimum.
    private static final BigDecimal ALMOST_COMPLETE_FRACTION = new BigDecimal("0.8");

    private static final Set<PaymentMethod> ONLINE_PAYMENT_METHODS = EnumSet.of(
            PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD, PaymentMethod.PAYPAL, PaymentMethod.STRIPE);

    private final WholesalePoolRepository poolRepository;
    private final WholesaleReservationRepository reservationRepository;
    private final ProductRepository productRepository;
    private final InventoryLogRepository inventoryLogRepository;
    private final UserRepository userRepository;
    private final AddressRepository addressRepository;
    private final NotificationService notificationService;
    private final WholesalePurchaseService purchaseService;
    private final WholesaleMapper mapper;
    private final OrderService orderService;

    @Override
    @Transactional(readOnly = true)
    public List<OrderDto> getPoolOrders(String sellerEmail, UUID poolId) {
        WholesalePool pool = requireOwnedPool(sellerEmail, poolId);
        List<String> orderNumbers = reservationRepository
                .findByPoolIdOrderByCreatedAtAsc(pool.getId()).stream()
                .map(r -> r.getOrder())
                .filter(java.util.Objects::nonNull)
                .map(Order::getOrderNumber)
                .toList();
        return orderService.getOrdersForSeller(sellerEmail, orderNumbers);
    }

    @Override
    @Transactional
    public WholesalePoolDto openPoolForOffer(WholesaleOffer offer) {
        Product product = offer.getProduct();
        int lotNumber = poolRepository.findMaxLotNumberForOffer(offer.getId()).orElse(0) + 1;
        int lotCapacity = offer.getMaxAvailableQuantity();

        Integer before = productRepository.findStockQuantityById(product.getId());
        if (productRepository.decrementStockIfAvailable(product.getId(), lotCapacity) == 0) {
            throw new ApiException("Not enough stock to open this wholesale lot: needs " + lotCapacity
                    + " unit(s), only " + (before == null ? 0 : before) + " in stock", HttpStatus.BAD_REQUEST);
        }
        inventoryLogRepository.save(InventoryLog.builder()
                .product(product)
                .sellerStore(offer.getSellerStore())
                .previousQuantity(before != null ? before : 0)
                .newQuantity((before != null ? before : 0) - lotCapacity)
                .quantityChange(-lotCapacity)
                .reason("WHOLESALE_RESERVE")
                .referenceId("WHOLESALE_OFFER:" + offer.getId() + ":LOT" + lotNumber)
                .build());

        WholesalePool pool = WholesalePool.builder()
                .offer(offer)
                .lotNumber(lotNumber)
                .status(WholesalePoolStatus.OPEN)
                .wholesaleUnitPrice(offer.getWholesaleUnitPrice())
                .wholesaleMinimumQuantity(offer.getWholesaleMinimumQuantity())
                .lotCapacity(lotCapacity)
                .deadline(offer.getReservationDeadline())
                .build();
        return mapper.toPoolDto(poolRepository.save(pool));
    }

    @Override
    @Transactional(readOnly = true)
    public WholesalePoolDto getPool(UUID poolId) {
        return mapper.toPoolDto(requirePool(poolId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<WholesalePoolDto> getPoolsForOffer(UUID offerId) {
        return poolRepository.findByOfferIdOrderByLotNumberDesc(offerId).stream()
                .map(mapper::toPoolDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<WholesalePoolDto> getMarketplacePools() {
        return poolRepository.findOpenPoolsForMarketplace().stream()
                .map(mapper::toPoolDto)
                .toList();
    }

    @Override
    @Transactional
    public WholesaleReservationDto reserveQuantity(String userEmail, UUID poolId, ReserveWholesaleQuantityRequest request) {
        User user = requireUser(userEmail);
        // Row-locked so concurrent reservations against this pool serialize (spec section 15).
        WholesalePool pool = poolRepository.findByIdForUpdate(poolId)
                .orElseThrow(() -> new ResourceNotFoundException("WholesalePool", "id", poolId));
        WholesaleOffer offer = pool.getOffer();
        LocalDateTime now = LocalDateTime.now();

        if (offer.getStatus() != WholesaleOfferStatus.ACTIVE) {
            throw bad("This wholesale offer is not currently accepting reservations");
        }
        if (!pool.getStatus().acceptsReservations()) {
            throw bad("This wholesale pool is no longer open for reservations");
        }
        if (!pool.getDeadline().isAfter(now)) {
            throw bad("The reservation deadline for this wholesale pool has passed");
        }

        int quantity = request.getQuantity();
        if (quantity < offer.getMinQuantityPerCustomer()) {
            throw bad("Minimum quantity per customer is " + offer.getMinQuantityPerCustomer());
        }
        if (quantity > offer.getMaxQuantityPerCustomer()) {
            throw bad("Maximum quantity per customer is " + offer.getMaxQuantityPerCustomer());
        }
        if (quantity > pool.getRemainingQuantity()) {
            throw bad("Only " + pool.getRemainingQuantity() + " unit(s) remain in this wholesale pool");
        }

        Address address = addressRepository.findByIdAndUserId(request.getAddressId(), user.getId())
                .orElseThrow(() -> bad("Select a valid shipping address"));
        validatePaymentMethod(request.getPaymentMethod());

        BigDecimal unitPrice = pool.getWholesaleUnitPrice();
        BigDecimal totalAmount = unitPrice.multiply(BigDecimal.valueOf(quantity));

        WholesaleReservation reservation = WholesaleReservation.builder()
                .pool(pool)
                .user(user)
                .quantity(quantity)
                .unitPriceAtReservation(unitPrice)
                .deliveryCharge(BigDecimal.ZERO)
                .totalAmount(totalAmount)
                .status(WholesaleReservationStatus.RESERVED)
                .paymentStatus(PaymentStatus.COMPLETED) // sandbox payment captured at reservation
                .paymentMethod(request.getPaymentMethod())
                .paymentReference("txn_cwp_" + UUID.randomUUID().toString().replace("-", "").substring(0, 20))
                .shippingAddressLine1(address.getStreetAddress())
                .shippingAddressLine2(address.getApartment())
                .shippingCity(address.getCity())
                .shippingState(address.getState())
                .shippingPostalCode(address.getPostalCode())
                .shippingCountry(address.getCountry())
                .reservedAt(now)
                .build();
        reservationRepository.save(reservation);

        pool.setPooledQuantity(pool.getPooledQuantity() + quantity);
        pool.setParticipantCount(pool.getParticipantCount() + 1);
        boolean justCompleted = applyPoolProgress(pool);
        poolRepository.save(pool);

        if (justCompleted) {
            purchaseService.completePool(pool);
            if (offer.isAutoReopenNewLot() && offer.getStatus() == WholesaleOfferStatus.ACTIVE) {
                tryReopenLot(offer);
            }
        }

        return mapper.toReservationDto(reservation);
    }

    /** Opens another lot after one completes (spec section 7); failures don't roll back the completed purchase. */
    private void tryReopenLot(WholesaleOffer offer) {
        try {
            openPoolForOffer(offer);
        } catch (ApiException ex) {
            notify(offer.getSellerStore().getUser(), "Couldn't auto-open the next wholesale lot",
                    "Lot #" + (poolRepository.findMaxLotNumberForOffer(offer.getId()).orElse(0))
                            + " for '" + shortText(offer.getProduct().getName(), 80)
                            + "' completed, but a new lot could not be opened automatically: " + ex.getMessage());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<WholesaleReservationDto> getMyReservations(String userEmail) {
        User user = requireUser(userEmail);
        return reservationRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(mapper::toReservationDto)
                .toList();
    }

    @Override
    @Transactional
    public WholesaleReservationDto cancelReservation(String userEmail, UUID reservationId, String reason) {
        User user = requireUser(userEmail);
        WholesaleReservation reservation = reservationRepository.findByIdAndUserId(reservationId, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("WholesaleReservation", "id", reservationId));

        if (reservation.getStatus() != WholesaleReservationStatus.RESERVED) {
            throw bad("This reservation can no longer be cancelled");
        }

        // Lock the pool before touching pooledQuantity, matching the lock order reserveQuantity uses.
        WholesalePool pool = poolRepository.findByIdForUpdate(reservation.getPool().getId())
                .orElseThrow(() -> new ResourceNotFoundException("WholesalePool", "id", reservation.getPool().getId()));

        if (!pool.getStatus().acceptsReservations()) {
            throw bad("This wholesale pool has already completed; cancel through your order instead");
        }

        reservation.setStatus(WholesaleReservationStatus.CANCELLED);
        reservation.setPaymentStatus(PaymentStatus.REFUNDED);
        reservation.setRefundAmount(reservation.getTotalAmount());
        reservation.setCancelledAt(LocalDateTime.now());
        reservation.setCancellationReason(shortText(reasonOrDefault(reason, "Cancelled by the customer"), 500));
        reservationRepository.save(reservation);

        pool.setPooledQuantity(Math.max(0, pool.getPooledQuantity() - reservation.getQuantity()));
        pool.setParticipantCount(Math.max(0, pool.getParticipantCount() - 1));
        revertPoolProgressIfNeeded(pool);
        poolRepository.save(pool);

        return mapper.toReservationDto(reservation);
    }

    @Override
    @Transactional
    public void failExpiredPool(UUID poolId) {
        WholesalePool pool = poolRepository.findByIdForUpdate(poolId)
                .orElseThrow(() -> new ResourceNotFoundException("WholesalePool", "id", poolId));
        if (!pool.getStatus().acceptsReservations() || pool.getDeadline().isAfter(LocalDateTime.now())) {
            return; // already completed/closed, or no longer actually expired
        }

        WholesaleOffer offer = pool.getOffer();
        LocalDateTime now = LocalDateTime.now();
        List<WholesaleReservation> reservations =
                reservationRepository.findByPoolIdAndStatus(poolId, WholesaleReservationStatus.RESERVED);

        String productName = shortText(offer.getProduct().getName(), 60);
        for (WholesaleReservation reservation : reservations) {
            reservation.setStatus(WholesaleReservationStatus.REFUNDED);
            reservation.setPaymentStatus(PaymentStatus.REFUNDED);
            reservation.setRefundAmount(reservation.getTotalAmount());
            reservation.setCancelledAt(now);
            reservation.setCancellationReason("Wholesale pool failed: deadline reached before the wholesale minimum was met");
            reservationRepository.save(reservation);

            notify(reservation.getUser(), "Wholesale pool did not reach its minimum",
                    "The wholesale pool for '" + productName + "' did not reach its minimum quantity by the deadline. "
                            + "Your reservation was cancelled and " + money(reservation.getTotalAmount()) + " refunded.",
                    CUSTOMER_LINK);
        }

        // The lot's full capacity was reserved from stock when it opened; none of it sold, so release all of it.
        int leftover = pool.getLotCapacity();
        if (leftover > 0) {
            Product product = offer.getProduct();
            Integer before = productRepository.findStockQuantityById(product.getId());
            productRepository.incrementStock(product.getId(), leftover);
            inventoryLogRepository.save(InventoryLog.builder()
                    .product(product)
                    .sellerStore(offer.getSellerStore())
                    .previousQuantity(before != null ? before : 0)
                    .newQuantity((before != null ? before : 0) + leftover)
                    .quantityChange(leftover)
                    .reason("WHOLESALE_RELEASE_FAILED")
                    .referenceId("WHOLESALE_OFFER:" + offer.getId() + ":LOT" + pool.getLotNumber())
                    .build());
        }

        pool.setStatus(WholesalePoolStatus.FAILED);
        pool.setClosedAt(now);
        pool.setCloseCode(WholesaleCloseCode.DEADLINE_REACHED_BELOW_MINIMUM);
        poolRepository.save(pool);

        notify(offer.getSellerStore().getUser(), "Wholesale pool failed",
                "Lot #" + pool.getLotNumber() + " for '" + productName + "' did not reach its wholesale minimum ("
                        + pool.getPooledQuantity() + "/" + pool.getWholesaleMinimumQuantity()
                        + " units) by the deadline. All reservations were refunded and inventory released.");
    }

    // ----- Helpers -----------------------------------------------------------------------------

    /** Drops a pool back to OPEN if a cancellation pulled it back below the almost-complete threshold. */
    private void revertPoolProgressIfNeeded(WholesalePool pool) {
        if (pool.getStatus() != WholesalePoolStatus.ALMOST_COMPLETE) {
            return;
        }
        BigDecimal threshold = BigDecimal.valueOf(pool.getWholesaleMinimumQuantity()).multiply(ALMOST_COMPLETE_FRACTION);
        if (BigDecimal.valueOf(pool.getPooledQuantity()).compareTo(threshold) < 0) {
            pool.setStatus(WholesalePoolStatus.OPEN);
            pool.setAlmostCompleteNotified(false);
        }
    }

    /**
     * Advances pool status as pooledQuantity grows. Returns true the moment the pool first reaches
     * COMPLETED, so the caller can trigger order/purchase generation exactly once.
     */
    private boolean applyPoolProgress(WholesalePool pool) {
        if (pool.getPooledQuantity() >= pool.getWholesaleMinimumQuantity()) {
            boolean justCompleted = pool.getStatus() != WholesalePoolStatus.COMPLETED;
            if (justCompleted) {
                pool.setStatus(WholesalePoolStatus.COMPLETED);
                pool.setCompletedAt(LocalDateTime.now());
            }
            return justCompleted;
        }
        BigDecimal threshold = BigDecimal.valueOf(pool.getWholesaleMinimumQuantity()).multiply(ALMOST_COMPLETE_FRACTION);
        if (!pool.isAlmostCompleteNotified() && BigDecimal.valueOf(pool.getPooledQuantity()).compareTo(threshold) >= 0) {
            pool.setStatus(WholesalePoolStatus.ALMOST_COMPLETE);
            pool.setAlmostCompleteNotified(true);
            notify(pool.getOffer().getSellerStore().getUser(), "Wholesale pool almost complete",
                    "Lot #" + pool.getLotNumber() + " for '" + shortText(pool.getOffer().getProduct().getName(), 80)
                            + "' is close to its wholesale minimum: " + pool.getPooledQuantity() + "/"
                            + pool.getWholesaleMinimumQuantity() + " units pooled.");
        }
        return false;
    }

    private void validatePaymentMethod(PaymentMethod method) {
        if (method == null || !ONLINE_PAYMENT_METHODS.contains(method)) {
            throw bad("Wholesale reservations require an online payment method (card, PayPal or Stripe)");
        }
    }

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    private WholesalePool requirePool(UUID poolId) {
        return poolRepository.findById(poolId)
                .orElseThrow(() -> bad("This wholesale lot could not be found"));
    }

    /** A lot the signed-in seller owns, so a seller cannot read another store's lot. */
    private WholesalePool requireOwnedPool(String sellerEmail, UUID poolId) {
        WholesalePool pool = requirePool(poolId);
        SellerStore store = pool.getOffer() == null ? null : pool.getOffer().getSellerStore();
        boolean owned = store != null && store.getUser() != null
                && sellerEmail.equalsIgnoreCase(store.getUser().getEmail());
        if (!owned) {
            throw new ResourceNotFoundException("WholesalePool", "id", poolId);
        }
        return pool;
    }

    private void notify(User recipient, String title, String message) {
        notify(recipient, title, message, SELLER_LINK);
    }

    private void notify(User recipient, String title, String message, String link) {
        if (recipient == null) {
            return;
        }
        notificationService.sendNotification(SendNotificationRequest.builder()
                .userId(recipient.getId())
                .title(shortText(title, 150))
                .message(shortText(message, 1000))
                .type("WHOLESALE_POOL")
                .link(link)
                .build());
    }

    private static String reasonOrDefault(String reason, String fallback) {
        return reason != null && !reason.isBlank() ? reason.trim() : fallback;
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
