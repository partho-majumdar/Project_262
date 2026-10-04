package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.notification.SendNotificationRequest;
import com.groupmart.dto.order.DeliveryEstimateSettingsDto;
import com.groupmart.entity.Order;
import com.groupmart.entity.OrderStatus;
import com.groupmart.entity.OrderType;
import com.groupmart.repository.OrderRepository;
import com.groupmart.service.AuditLogService;
import com.groupmart.service.DeliveryEstimateService;
import com.groupmart.service.NotificationService;
import com.groupmart.service.PlatformSettingService;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The delivery estimate is a platform rule ("standard orders arrive in 5 working days"), stored in platform
 * settings, with a per-order override an administrator can set when one delivery slips.
 */
@Service
@RequiredArgsConstructor
public class DeliveryEstimateServiceImpl implements DeliveryEstimateService {

    public static final String AUTO = "AUTO";
    public static final String ADMIN = "ADMIN";

    static final String KEY_STANDARD = "delivery.days.standard";
    static final String KEY_EXPRESS = "delivery.days.express";
    static final String KEY_OVERNIGHT = "delivery.days.overnight";
    static final String KEY_GROUP_BUY_EXTRA = "delivery.days.groupBuyExtra";
    static final String KEY_CUTOFF_HOUR = "delivery.cutoffHour";
    static final String KEY_SKIP_WEEKENDS = "delivery.skipWeekends";

    private static final Map<String, Integer> DEFAULTS = Map.of(
            KEY_STANDARD, 5,
            KEY_EXPRESS, 2,
            KEY_OVERNIGHT, 1,
            KEY_GROUP_BUY_EXTRA, 2,
            KEY_CUTOFF_HOUR, 17);
    private static final boolean DEFAULT_SKIP_WEEKENDS = true;
    /** Friday and Saturday are the local weekend. */
    private static final Set<DayOfWeek> WEEKEND = EnumSet.of(DayOfWeek.FRIDAY, DayOfWeek.SATURDAY);
    private static final int MAX_DAYS = 90;
    /** Orders that have not arrived yet, so a rule change still matters to the shopper. */
    private static final Set<OrderStatus> OPEN_STATUSES =
            EnumSet.of(OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.SHIPPED);
    private static final DateTimeFormatter READABLE = DateTimeFormatter.ofPattern("d MMM yyyy 'by' h:mm a");

    private final PlatformSettingService platformSettingService;
    private final OrderRepository orderRepository;
    private final NotificationService notificationService;
    private final AuditLogService auditLogService;

    // ----- Settings ----------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public DeliveryEstimateSettingsDto getSettings() {
        Map<String, String> stored = platformSettingService.getSettingsAsMap();
        return DeliveryEstimateSettingsDto.builder()
                .standardDays(intSetting(stored, KEY_STANDARD))
                .expressDays(intSetting(stored, KEY_EXPRESS))
                .overnightDays(intSetting(stored, KEY_OVERNIGHT))
                .groupBuyExtraDays(intSetting(stored, KEY_GROUP_BUY_EXTRA))
                .cutoffHour(intSetting(stored, KEY_CUTOFF_HOUR))
                .skipWeekends(booleanSetting(stored))
                .build();
    }

    @Override
    @Transactional
    public DeliveryEstimateSettingsDto updateSettings(String adminEmail, DeliveryEstimateSettingsDto settings) {
        DeliveryEstimateSettingsDto current = getSettings();
        save(KEY_STANDARD, clampDays(settings.getStandardDays(), current.getStandardDays()), adminEmail);
        save(KEY_EXPRESS, clampDays(settings.getExpressDays(), current.getExpressDays()), adminEmail);
        save(KEY_OVERNIGHT, clampDays(settings.getOvernightDays(), current.getOvernightDays()), adminEmail);
        save(KEY_GROUP_BUY_EXTRA, clampDays(settings.getGroupBuyExtraDays(), current.getGroupBuyExtraDays()), adminEmail);
        save(KEY_CUTOFF_HOUR, clampHour(settings.getCutoffHour(), current.getCutoffHour()), adminEmail);
        save(KEY_SKIP_WEEKENDS, settings.getSkipWeekends() != null ? settings.getSkipWeekends() : current.getSkipWeekends(),
                adminEmail);

        DeliveryEstimateSettingsDto saved = getSettings();
        int recalculated = Boolean.TRUE.equals(settings.getRecalculateExisting()) ? recalculateOpenOrders() : 0;
        saved.setRecalculatedOrders(recalculated);

        auditLogService.logActivity(adminEmail, "DELIVERY_RULE_UPDATE", "ORDER",
                "Delivery estimate rule: standard " + saved.getStandardDays() + "d, express " + saved.getExpressDays()
                        + "d, overnight " + saved.getOvernightDays() + "d, group buy +" + saved.getGroupBuyExtraDays()
                        + "d, cut-off " + saved.getCutoffHour() + ":00, weekends "
                        + (Boolean.TRUE.equals(saved.getSkipWeekends()) ? "skipped" : "counted")
                        + (recalculated > 0 ? ". Re-dated " + recalculated + " open order(s)." : ""),
                null);
        return saved;
    }

    /** Re-dates orders still on the automatic estimate; an administrator's own date is never touched. */
    private int recalculateOpenOrders() {
        List<Order> orders = orderRepository.findByStatusIn(OPEN_STATUSES);
        int changed = 0;
        for (Order order : orders) {
            if (ADMIN.equals(order.getEstimatedDeliverySource())) {
                continue;
            }
            LocalDateTime from = order.getShippedAt() != null ? order.getShippedAt() : order.getCreatedAt();
            LocalDateTime next = estimate(order, from != null ? from : LocalDateTime.now());
            if (!next.equals(order.getEstimatedDeliveryAt())) {
                order.setEstimatedDeliveryAt(next);
                order.setEstimatedDeliverySource(AUTO);
                orderRepository.save(order);
                changed++;
            }
        }
        return changed;
    }

    // ----- Applying the rule -------------------------------------------------------------------

    @Override
    public void applyOnPlacement(Order order) {
        order.setEstimatedDeliveryAt(estimate(order, LocalDateTime.now()));
        order.setEstimatedDeliverySource(AUTO);
    }

    @Override
    public void applyOnShipped(Order order) {
        order.setShippedAt(LocalDateTime.now());
        if (!ADMIN.equals(order.getEstimatedDeliverySource())) {
            order.setEstimatedDeliveryAt(estimate(order, order.getShippedAt()));
            order.setEstimatedDeliverySource(AUTO);
        }
    }

    /** Working days from {@code from}, landing on the cut-off hour. */
    private LocalDateTime estimate(Order order, LocalDateTime from) {
        DeliveryEstimateSettingsDto rule = getSettings();
        int days = switch (order.getShippingOptionId() == null ? "" : order.getShippingOptionId().toUpperCase()) {
            case "PRIORITY_EXPRESS" -> rule.getExpressDays();
            case "OVERNIGHT_COURIER" -> rule.getOvernightDays();
            default -> rule.getStandardDays();
        };
        if (order.getOrderType() == OrderType.GROUP_BUY) {
            days += rule.getGroupBuyExtraDays();
        }

        LocalDateTime date = from;
        for (int added = 0; added < days; added++) {
            date = date.plusDays(1);
            if (Boolean.TRUE.equals(rule.getSkipWeekends())) {
                while (WEEKEND.contains(date.getDayOfWeek())) {
                    date = date.plusDays(1);
                }
            }
        }
        return date.withHour(rule.getCutoffHour()).withMinute(0).withSecond(0).withNano(0);
    }

    // ----- Administrator override --------------------------------------------------------------

    @Override
    @Transactional
    public Order setAdminEstimate(String adminEmail, String orderNumber, LocalDateTime estimatedDeliveryAt,
                                  String note, boolean resetToAutomatic) {
        Order order = orderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Order", "orderNumber", orderNumber));
        if (order.getStatus() == OrderStatus.CANCELLED || order.getStatus() == OrderStatus.REFUNDED) {
            throw new ApiException("This order is " + order.getStatus().name().toLowerCase() + ", so it has no delivery date",
                    HttpStatus.BAD_REQUEST);
        }
        LocalDateTime previous = order.getEstimatedDeliveryAt();

        if (resetToAutomatic) {
            LocalDateTime from = order.getShippedAt() != null ? order.getShippedAt() : order.getCreatedAt();
            order.setEstimatedDeliveryAt(estimate(order, from != null ? from : LocalDateTime.now()));
            order.setEstimatedDeliverySource(AUTO);
            order.setEstimatedDeliveryNote(null);
        } else {
            if (estimatedDeliveryAt == null) {
                throw new ApiException("Choose a delivery date", HttpStatus.BAD_REQUEST);
            }
            if (estimatedDeliveryAt.isAfter(LocalDateTime.now().plusDays(MAX_DAYS))) {
                throw new ApiException("The delivery date cannot be more than " + MAX_DAYS + " days away",
                        HttpStatus.BAD_REQUEST);
            }
            order.setEstimatedDeliveryAt(estimatedDeliveryAt);
            order.setEstimatedDeliverySource(ADMIN);
            order.setEstimatedDeliveryNote(note != null && !note.isBlank()
                    ? GroupBuyEventRecorder.shortText(note.trim(), 200) : null);
        }

        Order saved = orderRepository.save(order);
        if (!saved.getEstimatedDeliveryAt().equals(previous)) {
            notifyCustomer(saved, previous);
        }
        auditLogService.logActivity(adminEmail, "DELIVERY_ESTIMATE_UPDATE", "ORDER",
                "Order " + orderNumber + ": delivery estimate "
                        + (previous != null ? previous.format(READABLE) : "not set") + " → "
                        + saved.getEstimatedDeliveryAt().format(READABLE)
                        + (resetToAutomatic ? " (back to the automatic rule)" : " (set by an administrator)")
                        + (saved.getEstimatedDeliveryNote() != null ? ". Note: " + saved.getEstimatedDeliveryNote() : ""),
                null);
        return saved;
    }

    private void notifyCustomer(Order order, LocalDateTime previous) {
        String when = order.getEstimatedDeliveryAt().format(READABLE);
        String message = (previous == null
                ? "Order " + order.getOrderNumber() + " is expected " + when + "."
                : "Order " + order.getOrderNumber() + " is now expected " + when + " instead of " + previous.format(READABLE) + ".")
                + (order.getEstimatedDeliveryNote() != null ? " " + order.getEstimatedDeliveryNote() : "");
        notificationService.sendNotification(SendNotificationRequest.builder()
                .userId(order.getUser().getId())
                .title("Delivery date updated")
                .message(message)
                .type("ORDER_UPDATE")
                .link("/orders/tracking?order=" + order.getOrderNumber())
                .build());
    }

    // ----- Setting helpers ---------------------------------------------------------------------

    /** Missing or unreadable settings fall back to the defaults, so the estimate always has a rule to follow. */
    private static int intSetting(Map<String, String> stored, String key) {
        String value = stored.get(key);
        if (value == null || value.isBlank()) {
            return DEFAULTS.get(key);
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException ex) {
            return DEFAULTS.get(key);
        }
    }

    private static boolean booleanSetting(Map<String, String> stored) {
        String value = stored.get(KEY_SKIP_WEEKENDS);
        return value == null || value.isBlank() ? DEFAULT_SKIP_WEEKENDS : Boolean.parseBoolean(value.trim());
    }

    private void save(String key, Object value, String adminEmail) {
        String text = String.valueOf(value);
        if (platformSettingService.getSettingsAsMap().containsKey(key)) {
            platformSettingService.updateSetting(key, text, adminEmail);
        } else {
            platformSettingService.createSetting(key, text, "Delivery estimate rule", adminEmail);
        }
    }

    private static int clampDays(Integer value, Integer fallback) {
        if (value == null) {
            return fallback;
        }
        return Math.max(0, Math.min(MAX_DAYS, value));
    }

    private static int clampHour(Integer value, Integer fallback) {
        if (value == null) {
            return fallback;
        }
        return Math.max(0, Math.min(23, value));
    }
}
