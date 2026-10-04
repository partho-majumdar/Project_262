package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "group_buy_campaigns", indexes = {
        @Index(name = "idx_gb_campaign_status", columnList = "status"),
        @Index(name = "idx_gb_campaign_store", columnList = "seller_store_id"),
        @Index(name = "idx_gb_campaign_product", columnList = "product_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupBuyCampaign {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_store_id", nullable = false)
    private SellerStore sellerStore;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "description", length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private GroupBuyCampaignStatus status = GroupBuyCampaignStatus.DRAFT;

    // Product price captured when the campaign was configured; tiers discount from this.
    @Column(name = "base_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal basePrice;

    // Seller's own cost per unit, used only for profit and margin analytics. Never shown to shoppers.
    @Column(name = "unit_cost", precision = 12, scale = 2)
    private BigDecimal unitCost;

    @Column(name = "min_participants", nullable = false)
    private int minParticipants;

    @Column(name = "max_participants", nullable = false)
    private int maxParticipants;

    @Column(name = "max_quantity_per_user", nullable = false)
    @Builder.Default
    private int maxQuantityPerUser = 1;

    // Units moved out of product stock into this campaign's pool on activation.
    @Column(name = "reserved_quantity", nullable = false)
    private int reservedQuantity;

    // Units held by open-group members plus units already sold.
    @Column(name = "committed_quantity", nullable = false)
    @Builder.Default
    private int committedQuantity = 0;

    @Column(name = "sold_quantity", nullable = false)
    @Builder.Default
    private int soldQuantity = 0;

    @Column(name = "group_duration_hours", nullable = false)
    private int groupDurationHours;

    @Column(name = "start_at", nullable = false)
    private LocalDateTime startAt;

    @Column(name = "end_at", nullable = false)
    private LocalDateTime endAt;

    @Column(name = "inventory_reserved", nullable = false)
    @Builder.Default
    private boolean inventoryReserved = false;

    @Column(name = "inventory_released", nullable = false)
    @Builder.Default
    private boolean inventoryReleased = false;

    @Column(name = "rejection_reason", length = 500)
    private String rejectionReason;

    @Column(name = "closing_note", length = 500)
    private String closingNote;

    // Set when the campaign is cancelled, so reports can tell seller and admin cancellations apart
    @Enumerated(EnumType.STRING)
    @Column(name = "close_code", length = 40)
    private GroupBuyCloseCode closeCode;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    // Nullable timestamp rather than a boolean so Hibernate can add the column to existing rows.
    @Column(name = "followers_ending_alert_at")
    private LocalDateTime followersEndingAlertAt;

    @OneToMany(mappedBy = "campaign", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("minParticipants ASC")
    @Builder.Default
    private List<GroupBuyPriceTier> tiers = new ArrayList<>();

    @Version
    @Column(name = "version")
    private Long version;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public int getAvailableQuantity() {
        return Math.max(0, reservedQuantity - committedQuantity);
    }
}
