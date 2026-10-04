package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** A shopper following a group deal to hear about new discounts, launches and expiry. */
@Entity
@Table(name = "group_buy_deal_follows",
        uniqueConstraints = @UniqueConstraint(name = "uk_gb_follow_campaign_user", columnNames = {"campaign_id", "user_id"}),
        indexes = @Index(name = "idx_gb_follow_user", columnList = "user_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupBuyDealFollow {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "campaign_id", nullable = false)
    private GroupBuyCampaign campaign;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // Lowest group price this follower was already told about, so each discount is announced once.
    @Column(name = "last_alerted_price", precision = 12, scale = 2)
    private BigDecimal lastAlertedPrice;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
