package com.groupmart.service;

import com.groupmart.dto.order.DeliveryEstimateSettingsDto;
import com.groupmart.entity.Order;

/** Works out the estimated delivery date shown on order tracking, and lets administrators steer it. */
public interface DeliveryEstimateService {

    DeliveryEstimateSettingsDto getSettings();

    /** Saves the rule; when {@code recalculateExisting} is set, re-dates open orders still on the automatic estimate. */
    DeliveryEstimateSettingsDto updateSettings(String adminEmail, DeliveryEstimateSettingsDto settings);

    /** Sets the automatic estimate on a new order, counting from now. */
    void applyOnPlacement(Order order);

    /** Moves the automatic estimate to count from dispatch. An administrator's own date is left alone. */
    void applyOnShipped(Order order);

    /** Replaces the estimate with an administrator's date, or clears it back to the automatic one. */
    Order setAdminEstimate(String adminEmail, String orderNumber, java.time.LocalDateTime estimatedDeliveryAt,
                           String note, boolean resetToAutomatic);
}
