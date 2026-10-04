package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.groupmart.dto.notification.SendNotificationRequest;
import com.groupmart.entity.GroupBuyActivity;
import com.groupmart.entity.GroupBuyGroup;
import com.groupmart.entity.GroupBuyParticipant;
import com.groupmart.entity.Role;
import com.groupmart.entity.User;
import com.groupmart.repository.GroupBuyActivityRepository;
import com.groupmart.repository.UserRepository;
import com.groupmart.service.NotificationService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.Set;
import java.util.UUID;

/** Records group activity timeline entries and sends in-app notifications for group buy events. */
@Component
@RequiredArgsConstructor
public class GroupBuyEventRecorder {

    public static final String SELLER_LINK = "/seller/dashboard?tab=group-buys";
    public static final String ADMIN_LINK = "/admin/dashboard?tab=group-buys";
    private static final String GROUP_LINK_PREFIX = "/group-buy/groups/";
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("MMM d, h:mm a");

    private final GroupBuyActivityRepository activityRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    public void activity(GroupBuyGroup group, User actor, String type, String message) {
        activityRepository.save(GroupBuyActivity.builder()
                .buyGroup(group)
                .actor(actor)
                .type(type)
                .message(truncate(message, 500))
                .build());
    }

    public void notify(User recipient, String title, String message, String type, String link) {
        if (recipient == null) {
            return;
        }
        notificationService.sendNotification(SendNotificationRequest.builder()
                .userId(recipient.getId())
                .title(truncate(title, 150))
                .message(truncate(message, 1000))
                .type(type)
                .link(link)
                .build());
    }

    /** Alerts every active administrator; {@code view} opens a section of the admin Group Buying tab. */
    public void notifyAdmins(String title, String message, String view) {
        String link = view == null ? ADMIN_LINK : ADMIN_LINK + "&view=" + view;
        for (User admin : userRepository.findByRoleAndEnabledTrue(Role.ROLE_ADMIN)) {
            notify(admin, title, message, "GROUP_BUY_ADMIN", link);
        }
    }

    public void notifyMembers(Collection<GroupBuyParticipant> members, UUID excludedUserId,
                              String title, String message, String type, String link) {
        notifyMembersExcept(members, excludedUserId == null ? Set.of() : Set.of(excludedUserId), title, message, type, link);
    }

    public void notifyMembersExcept(Collection<GroupBuyParticipant> members, Set<UUID> excludedUserIds,
                                    String title, String message, String type, String link) {
        for (GroupBuyParticipant member : members) {
            if (excludedUserIds.contains(member.getUser().getId())) {
                continue;
            }
            notify(member.getUser(), title, message, type, link);
        }
    }

    public static String groupLink(UUID groupId) {
        return GROUP_LINK_PREFIX + groupId;
    }

    /** "Jane D." style name so other shoppers never see full names. */
    public static String displayName(User user) {
        if (user == null) {
            return "Someone";
        }
        String first = user.getFirstName() != null ? user.getFirstName().trim() : "";
        String last = user.getLastName() != null ? user.getLastName().trim() : "";
        if (first.isEmpty()) {
            return "A shopper";
        }
        return last.isEmpty() ? first : first + " " + last.charAt(0) + ".";
    }

    public static String money(BigDecimal amount) {
        BigDecimal value = amount != null ? amount : BigDecimal.ZERO;
        return "৳" + value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    public static String shortText(String text, int max) {
        if (text == null) {
            return "";
        }
        return text.length() <= max ? text : text.substring(0, max - 1) + "…";
    }

    public static String formatTime(LocalDateTime time) {
        return time == null ? "" : time.format(TIME_FORMAT);
    }

    private static String truncate(String text, int max) {
        if (text == null) {
            return "";
        }
        return text.length() <= max ? text : text.substring(0, max);
    }
}
