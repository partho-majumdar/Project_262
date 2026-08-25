package com.groupmart.service;

import java.util.List;
import java.util.UUID;

import com.groupmart.dto.notification.NotificationDto;
import com.groupmart.dto.notification.SendNotificationRequest;

public interface NotificationService {

    List<NotificationDto> getUserNotifications(String userEmail);

    long getUnreadCount(String userEmail);

    NotificationDto markAsRead(String userEmail, UUID notificationId);

    void markAllAsRead(String userEmail);

    NotificationDto sendNotification(SendNotificationRequest request);
}
