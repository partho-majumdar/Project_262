package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "group_buy_groups", indexes = {
        @Index(name = "idx_gb_group_campaign", columnList = "campaign_id"),
        @Index(name = "idx_gb_group_status_expiry", columnList = "status, expires_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupBuyGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "campaign_id", nullable = false)
    private GroupBuyCampaign campaign;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "started_by_id", nullable = false)
    private User startedBy;

    // Current organizer; passes to the earliest remaining member if the leader leaves.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "leader_id", nullable = false)
    private User leader;

    @Column(name = "invite_code", nullable = false, unique = true, length = 16)
    private String inviteCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private GroupBuyGroupStatus status = GroupBuyGroupStatus.OPEN;

    @Column(name = "participant_count", nullable = false)
    @Builder.Default
    private int participantCount = 0;

    @Column(name = "total_quantity", nullable = false)
    @Builder.Default
    private int totalQuantity = 0;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "final_unit_price", precision = 12, scale = 2)
    private BigDecimal finalUnitPrice;

    @Column(name = "failure_reason", length = 500)
    private String failureReason;

    // Null for open and successful groups, and for groups closed before this column existed
    @Enumerated(EnumType.STRING)
    @Column(name = "close_code", length = 40)
    private GroupBuyCloseCode closeCode;

    @Column(name = "almost_there_notified", nullable = false)
    @Builder.Default
    private boolean almostThereNotified = false;

    @Column(name = "expiry_reminder_sent", nullable = false)
    @Builder.Default
    private boolean expiryReminderSent = false;

    @Version
    @Column(name = "version")
    private Long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
