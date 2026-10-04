package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.dto.notification.SendNotificationRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.DeliveryEstimateService;
import com.groupmart.service.NotificationService;
import com.groupmart.service.WholesalePurchaseService;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static com.groupmart.service.impl.GroupBuyEventRecorder.money;

@Service
@RequiredArgsConstructor
public class WholesalePurchaseServiceImpl implements WholesalePurchaseService {

    private static final String SELLER_LINK = "/seller/dashboard?tab=wholesale";
    private static final String CUSTOMER_LINK = "/orders";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final WholesalePurchaseRepository purchaseRepository;
    private final WholesaleReservationRepository reservationRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final ProductRepository productRepository;
    private final InventoryLogRepository inventoryLogRepository;
    private final DeliveryEstimateService deliveryEstimateService;
    private final NotificationService notificationService;

    @Override
    @Transactional
    public void completePool(WholesalePool pool) {
        if (purchaseRepository.findByPoolId(pool.getId()).isPresent()) {
            return; // already converted; guards against re-entry
        }

        WholesaleOffer offer = pool.getOffer();
        LocalDateTime now = LocalDateTime.now();

        WholesalePurchase purchase = purchaseRepository.save(WholesalePurchase.builder()
                .pool(pool)
                .confirmedUnitPrice(pool.getWholesaleUnitPrice())
                .totalConfirmedQuantity(pool.getPooledQuantity())
                .participantCount(pool.getParticipantCount())
                .confirmedAt(now)
                .build());

        List<WholesaleReservation> reservations =
                reservationRepository.findByPoolIdAndStatus(pool.getId(), WholesaleReservationStatus.RESERVED);

        String productName = shortText(offer.getProduct().getName(), 60);
        for (WholesaleReservation reservation : reservations) {
            Order order = createOrder(offer, pool, purchase, reservation);
            recordPayment(order, reservation);

            reservation.setOrder(order);
            reservation.setStatus(WholesaleReservationStatus.CONVERTED);
            reservationRepository.save(reservation);

            notify(reservation.getUser(), "Wholesale purchase confirmed",
                    "The wholesale pool for '" + productName + "' reached its minimum. Order "
                            + order.getOrderNumber() + " was created for your " + reservation.getQuantity()
                            + " unit(s) at " + money(reservation.getUnitPriceAtReservation()) + " each.",
                    CUSTOMER_LINK);
        }

        pool.setStatus(WholesalePoolStatus.PROCESSING);
        releaseUnusedLotCapacity(pool);
        notify(offer.getSellerStore().getUser(), "Wholesale pool ready to fulfill",
                "Lot #" + pool.getLotNumber() + " for '" + productName + "' completed with "
                        + reservations.size() + " order(s) totalling " + pool.getPooledQuantity()
                        + " unit(s). Begin fulfillment from your wholesale dashboard.", SELLER_LINK);
    }

    /**
     * A lot's full capacity is reserved from stock when it opens (see WholesalePoolServiceImpl.openPoolForOffer),
     * but only pooledQuantity units end up sold once it completes. The gap becomes available again so a
     * new lot (manual or auto-reopened) can use it, matching spec section 7's "additional available inventory".
     */
    private void releaseUnusedLotCapacity(WholesalePool pool) {
        int leftover = pool.getLotCapacity() - pool.getPooledQuantity();
        if (leftover <= 0) {
            return;
        }
        Product product = pool.getOffer().getProduct();
        Integer before = productRepository.findStockQuantityById(product.getId());
        productRepository.incrementStock(product.getId(), leftover);
        inventoryLogRepository.save(InventoryLog.builder()
                .product(product)
                .sellerStore(pool.getOffer().getSellerStore())
                .previousQuantity(before != null ? before : 0)
                .newQuantity((before != null ? before : 0) + leftover)
                .quantityChange(leftover)
                .reason("WHOLESALE_RELEASE_LEFTOVER")
                .referenceId("WHOLESALE_OFFER:" + pool.getOffer().getId() + ":LOT" + pool.getLotNumber())
                .build());
    }

    private Order createOrder(WholesaleOffer offer, WholesalePool pool, WholesalePurchase purchase,
                               WholesaleReservation reservation) {
        Product product = offer.getProduct();
        BigDecimal total = reservation.getTotalAmount();

        Order order = Order.builder()
                .orderNumber(generateOrderNumber())
                .user(reservation.getUser())
                .status(OrderStatus.PENDING)
                .paymentStatus(PaymentStatus.COMPLETED)
                .paymentMethod(reservation.getPaymentMethod())
                .subtotalAmount(reservation.getUnitPriceAtReservation()
                        .multiply(BigDecimal.valueOf(reservation.getQuantity())))
                .taxAmount(BigDecimal.ZERO)
                .shippingAmount(reservation.getDeliveryCharge())
                .discountAmount(BigDecimal.ZERO)
                .totalAmount(total)
                .shippingAddressLine1(reservation.getShippingAddressLine1())
                .shippingAddressLine2(reservation.getShippingAddressLine2())
                .shippingCity(reservation.getShippingCity())
                .shippingState(reservation.getShippingState())
                .shippingPostalCode(reservation.getShippingPostalCode())
                .shippingCountry(reservation.getShippingCountry())
                .orderType(OrderType.WHOLESALE)
                .wholesalePurchaseId(purchase.getId())
                .items(new ArrayList<>())
                .build();
        deliveryEstimateService.applyOnPlacement(order);
        Order saved = orderRepository.save(order);

        OrderItem item = OrderItem.builder()
                .order(saved)
                .product(product)
                .sellerStore(offer.getSellerStore())
                .productName(product.getName())
                .productSku(product.getSku())
                .quantity(reservation.getQuantity())
                .unitPrice(reservation.getUnitPriceAtReservation())
                .subtotal(total)
                .build();
        saved.getItems().add(item);
        orderItemRepository.save(item);
        return saved;
    }

    private void recordPayment(Order order, WholesaleReservation reservation) {
        paymentTransactionRepository.save(PaymentTransaction.builder()
                .order(order)
                .transactionId(reservation.getPaymentReference())
                .paymentMethod(reservation.getPaymentMethod())
                .status(PaymentStatus.COMPLETED)
                .amount(reservation.getTotalAmount())
                .gatewayResponse("SANDBOX_WHOLESALE_CAPTURE: captured " + money(reservation.getTotalAmount())
                        + " reserved at " + reservation.getReservedAt())
                .build());
    }

    private void notify(User recipient, String title, String message, String link) {
        if (recipient == null) {
            return;
        }
        notificationService.sendNotification(SendNotificationRequest.builder()
                .userId(recipient.getId())
                .title(shortText(title, 150))
                .message(shortText(message, 1000))
                .type("WHOLESALE_PURCHASE")
                .link(link)
                .build());
    }

    private String generateOrderNumber() {
        String datePrefix = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        String orderNumber;
        do {
            orderNumber = "ORD-" + datePrefix + "-CWP" + String.format("%05d", RANDOM.nextInt(100_000));
        } while (orderRepository.existsByOrderNumber(orderNumber));
        return orderNumber;
    }

    private static String shortText(String text, int max) {
        if (text == null) {
            return null;
        }
        return text.length() <= max ? text : text.substring(0, max - 1) + "…";
    }
}
