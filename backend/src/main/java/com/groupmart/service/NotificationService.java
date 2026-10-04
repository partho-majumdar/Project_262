package com.groupmart.service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.groupmart.dto.notification.NotificationDto;
import com.groupmart.dto.notification.NotificationPreferenceDto;
import com.groupmart.dto.notification.SendNotificationRequest;

public interface NotificationService {

    /** Newest first; {@code limit} caps the list so the bell stays fast. */
    List<NotificationDto> getUserNotifications(String userEmail, int limit);

    long getUnreadCount(String userEmail);

    NotificationDto markAsRead(String userEmail, UUID notificationId);

    void markAllAsRead(String userEmail);

    /** Marks every unread notification in one category as read. */
    void markCategoryAsRead(String userEmail, String category);

    /** Stores the notification, or returns null when the recipient muted its category. */
    NotificationDto sendNotification(SendNotificationRequest request);

    List<NotificationPreferenceDto> getPreferences(String userEmail);

    List<NotificationPreferenceDto> updatePreferences(String userEmail, Map<String, Boolean> changes);
}
