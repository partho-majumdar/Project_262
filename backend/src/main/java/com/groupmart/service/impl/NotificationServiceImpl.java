package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.notification.NotificationDto;
import com.groupmart.dto.notification.NotificationPreferenceDto;
import com.groupmart.dto.notification.SendNotificationRequest;
import com.groupmart.entity.Notification;
import com.groupmart.entity.NotificationCategory;
import com.groupmart.entity.NotificationPreference;
import com.groupmart.entity.User;
import com.groupmart.repository.NotificationPreferenceRepository;
import com.groupmart.repository.NotificationRepository;
import com.groupmart.repository.UserRepository;
import com.groupmart.service.NotificationService;
import org.springframework.data.domain.PageRequest;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {

    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 200;

    private final NotificationRepository notificationRepository;
    private final NotificationPreferenceRepository preferenceRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public List<NotificationDto> getUserNotifications(String userEmail, int limit) {
        User user = requireUser(userEmail);
        int size = limit <= 0 ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);

        return notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId(), PageRequest.of(0, size)).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public long getUnreadCount(String userEmail) {
        User user = requireUser(userEmail);

        return notificationRepository.countByUserIdAndReadFalse(user.getId());
    }

    @Override
    @Transactional
    public NotificationDto markAsRead(String userEmail, UUID notificationId) {
        User user = requireUser(userEmail);
        Notification notification = notificationRepository.findById(notificationId)
                .filter(n -> n.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("Notification", "id", notificationId));

        notification.setRead(true);
        Notification updated = notificationRepository.save(notification);
        return mapToDto(updated);
    }

    @Override
    @Transactional
    public void markAllAsRead(String userEmail) {
        User user = requireUser(userEmail);

        List<Notification> notifications = notificationRepository.findByUserIdAndReadFalse(user.getId());
        notifications.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(notifications);
    }

    @Override
    @Transactional
    public void markCategoryAsRead(String userEmail, String category) {
        User user = requireUser(userEmail);
        NotificationCategory target = parseCategory(category);

        List<Notification> notifications = notificationRepository.findByUserIdAndReadFalse(user.getId()).stream()
                .filter(n -> NotificationCategory.fromType(n.getType()) == target)
                .toList();
        notifications.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(notifications);
    }

    @Override
    @Transactional
    public NotificationDto sendNotification(SendNotificationRequest request) {
        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", request.getUserId()));

        String type = request.getType() != null ? request.getType() : "ORDER_UPDATE";
        NotificationCategory category = NotificationCategory.fromType(type);
        if (!category.isMandatory()) {
            boolean enabled = preferenceRepository.findByUserId(user.getId())
                    .map(preference -> preference.isEnabled(category))
                    .orElse(true);
            if (!enabled) {
                return null;
            }
        }

        Notification notification = Notification.builder()
                .user(user)
                .title(request.getTitle())
                .message(request.getMessage())
                .type(type)
                .link(request.getLink())
                .read(false)
                .build();

        Notification saved = notificationRepository.save(notification);
        return mapToDto(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotificationPreferenceDto> getPreferences(String userEmail) {
        User user = requireUser(userEmail);
        return toPreferenceDtos(preferenceRepository.findByUserId(user.getId())
                .orElseGet(NotificationPreference::new));
    }

    @Override
    @Transactional
    public List<NotificationPreferenceDto> updatePreferences(String userEmail, Map<String, Boolean> changes) {
        User user = requireUser(userEmail);
        NotificationPreference preference = preferenceRepository.findByUserId(user.getId())
                .orElseGet(() -> NotificationPreference.builder().user(user).build());

        if (changes != null) {
            changes.forEach((key, enabled) -> {
                NotificationCategory category = parseCategory(key);
                if (enabled == null) {
                    return;
                }
                if (category.isMandatory() && !enabled) {
                    throw new ApiException(category.getLabel() + " notifications can't be turned off",
                            HttpStatus.BAD_REQUEST);
                }
                preference.setEnabled(category, enabled);
            });
        }

        return toPreferenceDtos(preferenceRepository.save(preference));
    }

    private List<NotificationPreferenceDto> toPreferenceDtos(NotificationPreference preference) {
        return Arrays.stream(NotificationCategory.values())
                .filter(category -> category != NotificationCategory.OTHER && category != NotificationCategory.ADMIN)
                .map(category -> NotificationPreferenceDto.builder()
                        .category(category.name())
                        .label(category.getLabel())
                        .description(category.getDescription())
                        .mandatory(category.isMandatory())
                        .enabled(category.isMandatory() || preference.isEnabled(category))
                        .build())
                .toList();
    }

    private NotificationCategory parseCategory(String value) {
        try {
            return NotificationCategory.valueOf(value == null ? "" : value.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ApiException("Unknown notification category: " + value, HttpStatus.BAD_REQUEST);
        }
    }

    private User requireUser(String userEmail) {
        return userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));
    }

    private NotificationDto mapToDto(Notification notification) {
        NotificationCategory category = NotificationCategory.fromType(notification.getType());
        return NotificationDto.builder()
                .id(notification.getId())
                .title(notification.getTitle())
                .message(notification.getMessage())
                .type(notification.getType())
                .category(category.name())
                .categoryLabel(category.getLabel())
                .link(notification.getLink())
                .read(notification.isRead())
                .createdAt(notification.getCreatedAt())
                .build();
    }
}
