package com.groupmart.service.impl;

import com.groupmart.dto.ai.AiAssistantResponse;
import com.groupmart.entity.Order;
import com.groupmart.entity.OrderItem;
import com.groupmart.entity.User;
import com.groupmart.repository.OrderRepository;
import com.groupmart.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Answers a customer's questions about their own orders — items, cost, status, delivery —
 * from the database, with no LLM involved.
 *
 * <p>Every lookup is scoped to the signed-in user's own orders. An order number alone is
 * never enough to see an order: the chat endpoint is public, so resolving order numbers
 * globally would let anyone read a stranger's order total and status by guessing numbers.
 */
@Component
@RequiredArgsConstructor
class OrderQuestionResponder {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d MMM yyyy");

    private static final Pattern ORDER_NUMBER = Pattern.compile("\\bord-\\d{6,8}-\\w+\\b", Pattern.CASE_INSENSITIVE);

    /**
     * Phrases that mean "tell me about my own orders". Deliberately phrase-based rather than
     * "order word + any pronoun": a looser rule turns ordinary shopping talk such as
     * "i want to buy headphones" into an order lookup.
     */
    private static final Pattern PERSONAL_ORDER = Pattern.compile(
            "\\bmy\\s+(recent\\s+|last\\s+|latest\\s+|previous\\s+|current\\s+|first\\s+)?"
                    + "(orders?|purchases?|parcels?|packages?|deliver(y|ies)|shipments?|receipts?|invoices?)\\b"
                    + "|\\bi\\s+(ordered|bought|purchased)\\b"
                    + "|\\bi\\s+have\\s+(ordered|bought|purchased)\\b"
                    + "|\\bdid\\s+i\\s+(order|buy|purchase)\\b"
                    + "|\\b(did|have)\\s+i\\s+spen[dt]\\b"
                    + "|\\bi\\s+spen[dt]\\b"
                    + "|\\border\\s+(status|history)\\b"
                    + "|\\btrack\\s+my\\b",
            Pattern.CASE_INSENSITIVE);

    /** Explicitly asking *how* to do something is a how-to question, not a lookup of their data. */
    private static final Pattern EXPLICIT_HOW_TO = Pattern.compile(
            "\\bhow\\s+(do|does|can|to|should|would)\\b|\\bstep\\s*by\\s*step\\b|\\bguide\\b|\\binstruction",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern LIST_INTENT = Pattern.compile(
            "\\ball\\b|\\blist\\b|\\bhistory\\b|\\brecent\\b|\\bhow\\s+many\\b|\\bevery\\b|\\borders\\b",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern TOTAL_SPEND_INTENT = Pattern.compile(
            "\\btotal\\s+spent\\b|\\bspent\\s+(in\\s+)?(total|overall|so\\s+far)\\b|\\bhow\\s+much\\s+have\\s+i\\s+spent\\b",
            Pattern.CASE_INSENSITIVE);

    /**
     * @return an answer when this is a question about the customer's own orders,
     *         or empty to let the normal RAG/how-to flow handle the message.
     */
    Optional<AiAssistantResponse> tryAnswer(String lowerMsg, String userEmail, String explicitOrderNumber) {
        String orderNumber = explicitOrderNumber != null && !explicitOrderNumber.isBlank()
                ? explicitOrderNumber.trim()
                : findOrderNumber(lowerMsg);

        boolean personalOrderQuestion = orderNumber != null || PERSONAL_ORDER.matcher(lowerMsg).find();

        if (!personalOrderQuestion) {
            return Optional.empty();
        }
        // "how do I track my order" wants the walkthrough, not a dump of their latest order.
        if (orderNumber == null && EXPLICIT_HOW_TO.matcher(lowerMsg).find()) {
            return Optional.empty();
        }

        if (userEmail == null) {
            return Optional.of(reply("ORDER_SIGN_IN_REQUIRED",
                    "To look up your orders I need to know who you are — please sign in to your GroupMart account, then ask me again. "
                            + "You can also see everything under Order History (/orders/history)."));
        }

        User user = userRepository.findByEmail(userEmail).orElse(null);
        if (user == null) {
            return Optional.of(reply("ORDER_SIGN_IN_REQUIRED",
                    "I couldn't load your account, so I can't look up your orders right now. Please sign in again and retry."));
        }

        List<Order> orders = orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        if (orders.isEmpty()) {
            return Optional.of(reply("ORDER_NONE",
                    "You don't have any orders on your account yet. Once you place one, ask me here and I'll tell you its status, items and total."));
        }

        if (orderNumber != null) {
            // Scoped to this user's own orders on purpose — see the class comment.
            Optional<Order> owned = orders.stream()
                    .filter(o -> o.getOrderNumber().equalsIgnoreCase(orderNumber))
                    .findFirst();
            return Optional.of(owned
                    .map(order -> reply("ORDER_DETAIL", describeOrder(order)))
                    .orElseGet(() -> reply("ORDER_NOT_FOUND",
                            "I couldn't find order " + orderNumber.toUpperCase() + " on your account. "
                                    + "Double-check the number in Order History (/orders/history) — it looks like ORD-20260726-8849.")));
        }

        if (TOTAL_SPEND_INTENT.matcher(lowerMsg).find()) {
            return Optional.of(reply("ORDER_TOTAL_SPEND", describeTotalSpend(orders)));
        }
        if (LIST_INTENT.matcher(lowerMsg).find()) {
            return Optional.of(reply("ORDER_LIST", describeOrderList(orders)));
        }
        return Optional.of(reply("ORDER_DETAIL", "Here's your most recent order.\n\n" + describeOrder(orders.get(0))));
    }

    private String describeOrder(Order order) {
        StringBuilder text = new StringBuilder();
        text.append("Order ").append(order.getOrderNumber());
        if (order.getCreatedAt() != null) {
            text.append(" placed on ").append(order.getCreatedAt().format(DATE));
        }
        text.append(" is currently ").append(pretty(order.getStatus().name())).append(". ");
        text.append(statusNarrative(order));

        List<OrderItem> items = order.getItems();
        if (items != null && !items.isEmpty()) {
            text.append("\n\nItems (").append(items.size()).append("):");
            for (OrderItem item : items) {
                text.append("\n• ").append(item.getProductName())
                        .append(" — ").append(item.getQuantity()).append(" × ").append(taka(item.getUnitPrice()))
                        .append(" = ").append(taka(item.getSubtotal()));
            }
        }

        text.append("\n\nSubtotal ").append(taka(order.getSubtotalAmount()));
        if (isPositive(order.getShippingAmount())) {
            text.append(" · Shipping ").append(taka(order.getShippingAmount()));
        }
        if (isPositive(order.getTaxAmount())) {
            text.append(" · Tax ").append(taka(order.getTaxAmount()));
        }
        if (isPositive(order.getDiscountAmount())) {
            text.append(" · Discount −").append(taka(order.getDiscountAmount()));
        }
        text.append("\nTotal: ").append(taka(order.getTotalAmount()))
                .append(" (payment ").append(pretty(order.getPaymentStatus().name()));
        if (order.getPaymentMethod() != null) {
            text.append(" via ").append(pretty(order.getPaymentMethod().name()));
        }
        text.append(")");

        return text.toString();
    }

    private String statusNarrative(Order order) {
        switch (order.getStatus()) {
            case PENDING:
                return "We've received it and it's waiting to be processed.";
            case PROCESSING:
                return "It's being prepared for shipment." + deliveryEstimate(order);
            case SHIPPED:
                return "It's on its way"
                        + (order.getShippedAt() != null ? ", shipped on " + order.getShippedAt().format(DATE) : "")
                        + "." + deliveryEstimate(order);
            case DELIVERED:
                return "It was delivered"
                        + (order.getDeliveredAt() != null ? " on " + order.getDeliveredAt().format(DATE) : "")
                        + ". If something's wrong with it you have 30 days from delivery to start a return.";
            case CANCELLED:
                return "This order was cancelled.";
            case REFUNDED:
                return "This order was refunded to your original payment method.";
            default:
                return "";
        }
    }

    private String deliveryEstimate(Order order) {
        LocalDateTime eta = order.getEstimatedDeliveryAt();
        return eta != null ? " Estimated delivery " + eta.format(DATE) + "." : "";
    }

    private String describeOrderList(List<Order> orders) {
        StringBuilder text = new StringBuilder("You have ")
                .append(orders.size()).append(orders.size() == 1 ? " order" : " orders")
                .append(" on your account");

        int shown = Math.min(orders.size(), 10);
        text.append(shown < orders.size() ? " — here are the " + shown + " most recent:" : ":");
        for (int i = 0; i < shown; i++) {
            Order order = orders.get(i);
            int itemCount = order.getItems() != null ? order.getItems().size() : 0;
            text.append("\n").append(i + 1).append(". ").append(order.getOrderNumber())
                    .append(" · ").append(order.getCreatedAt() != null ? order.getCreatedAt().format(DATE) : "—")
                    .append(" · ").append(pretty(order.getStatus().name()))
                    .append(" · ").append(taka(order.getTotalAmount()))
                    .append(itemCount > 0 ? " (" + itemCount + (itemCount == 1 ? " item)" : " items)") : "");
        }
        text.append("\n\nAsk me about any of them by number, for example \"track ")
                .append(orders.get(0).getOrderNumber()).append("\".");
        return text.toString();
    }

    private String describeTotalSpend(List<Order> orders) {
        BigDecimal total = orders.stream()
                .filter(o -> o.getTotalAmount() != null)
                .map(Order::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return "Across your " + orders.size() + (orders.size() == 1 ? " order" : " orders")
                + " you've spent " + taka(total) + " in total. Your most recent order was "
                + orders.get(0).getOrderNumber() + " for " + taka(orders.get(0).getTotalAmount()) + ".";
    }

    private String findOrderNumber(String lowerMsg) {
        Matcher matcher = ORDER_NUMBER.matcher(lowerMsg);
        return matcher.find() ? matcher.group() : null;
    }

    private boolean isPositive(BigDecimal amount) {
        return amount != null && amount.compareTo(BigDecimal.ZERO) > 0;
    }

    private String taka(BigDecimal amount) {
        return "৳" + (amount != null ? amount.toPlainString() : "0.00");
    }

    /** PENDING -> Pending, CASH_ON_DELIVERY -> Cash on delivery. */
    private String pretty(String enumName) {
        String spaced = enumName.toLowerCase().replace('_', ' ');
        return Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
    }

    private AiAssistantResponse reply(String intent, String text) {
        return AiAssistantResponse.builder()
                .intent(intent)
                .reply(text)
                .recommendedProducts(List.of())
                .suggestedPrompts(List.of("Show all my orders", "How do I return an item?", "What is your shipping policy?"))
                .timestamp(LocalDateTime.now())
                .build();
    }
}
