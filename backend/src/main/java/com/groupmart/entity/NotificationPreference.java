package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/** Per-user switches for the optional notification categories. Missing row means everything is on. */
@Entity
@Table(name = "notification_preferences")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "group_activity", nullable = false)
    @Builder.Default
    private boolean groupActivity = true;

    @Column(name = "deal_alerts", nullable = false)
    @Builder.Default
    private boolean dealAlerts = true;

    @Column(name = "order_updates", nullable = false)
    @Builder.Default
    private boolean orderUpdates = true;

    @Column(name = "seller_updates", nullable = false)
    @Builder.Default
    private boolean sellerUpdates = true;

    @Column(name = "promotions", nullable = false)
    @Builder.Default
    private boolean promotions = true;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public boolean isEnabled(NotificationCategory category) {
        return switch (category) {
            case GROUP_ACTIVITY -> groupActivity;
            case DEAL_ALERTS -> dealAlerts;
            case ORDERS -> orderUpdates;
            case SELLER -> sellerUpdates;
            case PROMOTIONS -> promotions;
            default -> true;
        };
    }

    public void setEnabled(NotificationCategory category, boolean enabled) {
        switch (category) {
            case GROUP_ACTIVITY -> groupActivity = enabled;
            case DEAL_ALERTS -> dealAlerts = enabled;
            case ORDERS -> orderUpdates = enabled;
            case SELLER -> sellerUpdates = enabled;
            case PROMOTIONS -> promotions = enabled;
            default -> { /* mandatory categories are always on */ }
        }
    }
}
