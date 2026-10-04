package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Seller-defined Collaborative Wholesale Purchasing offer: the reusable configuration
 * (product, wholesale terms, quantity limits) that WholesalePool instances are opened against.
 * See CWP spec section 3.1 and the core relationship in section 23.
 */
@Entity
@Table(name = "wholesale_offers", indexes = {
        @Index(name = "idx_wholesale_offer_status", columnList = "status"),
        @Index(name = "idx_wholesale_offer_store", columnList = "seller_store_id"),
        @Index(name = "idx_wholesale_offer_product", columnList = "product_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WholesaleOffer {

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

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private WholesaleOfferStatus status = WholesaleOfferStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(name = "mode", nullable = false, length = 30)
    @Builder.Default
    private WholesaleOfferMode mode = WholesaleOfferMode.MINIMUM_QUANTITY_BASED;

    // Wholesale unit price offered once the pool completes.
    @Column(name = "wholesale_unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal wholesaleUnitPrice;

    @Column(name = "wholesale_minimum_quantity", nullable = false)
    private int wholesaleMinimumQuantity;

    @Column(name = "max_available_quantity", nullable = false)
    private int maxAvailableQuantity;

    @Column(name = "min_quantity_per_customer", nullable = false)
    @Builder.Default
    private int minQuantityPerCustomer = 1;

    @Column(name = "max_quantity_per_customer", nullable = false)
    private int maxQuantityPerCustomer;

    @Column(name = "reservation_deadline", nullable = false)
    private LocalDateTime reservationDeadline;

    @Column(name = "expected_fulfillment_note", length = 300)
    private String expectedFulfillmentNote;

    @Column(name = "delivery_conditions", length = 1000)
    private String deliveryConditions;

    // Whether a new pool/lot may be opened automatically once one completes, while
    // maxAvailableQuantity across all of the offer's pools has not yet been exhausted.
    @Column(name = "auto_reopen_new_lot", nullable = false)
    @Builder.Default
    private boolean autoReopenNewLot = false;

    @Column(name = "rejection_reason", length = 500)
    private String rejectionReason;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;
    private WholesaleCloseCode closeCode;

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
