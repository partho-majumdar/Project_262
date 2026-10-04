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
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "order_number", nullable = false, unique = true, length = 50)
    private String orderNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @Builder.Default
    private List<OrderItem> items = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private OrderStatus status = OrderStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false, length = 30)
    @Builder.Default
    private PaymentStatus paymentStatus = PaymentStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 30)
    private PaymentMethod paymentMethod;

    @Column(name = "subtotal_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotalAmount;

    @Column(name = "tax_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal taxAmount;

    @Column(name = "shipping_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal shippingAmount;

    @Column(name = "discount_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "shipping_address_line1", nullable = false, length = 200)
    private String shippingAddressLine1;

    @Column(name = "shipping_address_line2", length = 200)
    private String shippingAddressLine2;

    @Column(name = "shipping_city", nullable = false, length = 100)
    private String shippingCity;

    @Column(name = "shipping_state", nullable = false, length = 100)
    private String shippingState;

    @Column(name = "shipping_postal_code", nullable = false, length = 30)
    private String shippingPostalCode;

    @Column(name = "shipping_country", nullable = false, length = 100)
    private String shippingCountry;

    @Column(name = "coupon_code", length = 50)
    private String couponCode;

    // Nullable so the column can be added to existing rows; null is treated as STANDARD.
    @Enumerated(EnumType.STRING)
    @Column(name = "order_type", length = 20)
    @Builder.Default
    private OrderType orderType = OrderType.STANDARD;

    @Column(name = "group_buy_group_id")
    private UUID groupBuyGroupId;

    @Column(name = "wholesale_purchase_id")
    private UUID wholesalePurchaseId;

    // Traceability for the other two collective purchasing mechanisms. Same pattern as the columns
    // above: orderType says which mechanism produced the order, the id says which campaign/auction.
    @Column(name = "reverse_group_buying_campaign_id")
    private UUID reverseGroupBuyingCampaignId;

    @Column(name = "group_buying_auction_id")
    private UUID groupBuyingAuctionId;

    /**
     * The winning eBay-style proxy auction this order came from.
     * <p>
     * Unique on purpose: a proxy auction can produce at most one order, so the database itself makes
     * a double close - the scheduler and the seller pressing "close" at the same instant - fail
     * instead of quietly creating a second winner's order.
     */
    @Column(name = "auction_id", unique = true)
    private UUID auctionId;

    /**
     * The group reverse demand this order fulfils one member's slice of.
     * <p>
     * Not unique, and deliberately so: one accepted offer fans out into one order per member, so a
     * demand legitimately points at many orders. The one-order-per-member rule is enforced on
     * {@link #groupReverseMemberId} instead, which is unique.
     */
    @Column(name = "group_reverse_demand_id")
    private UUID groupReverseDemandId;

    /**
     * The single group member this order belongs to. Unique, which is what stops a retried
     * order-generation pass from producing a member two separate orders.
     */
    @Column(name = "group_reverse_member_id", unique = true)
    private UUID groupReverseMemberId;

    /**
     * The seller whose accepted offer won the group, when the order did not come from the
     * product's own catalog store.
     */
    @Column(name = "group_reverse_store_id")
    private UUID groupReverseStoreId;

    // Shipping speed the shopper chose, kept so the delivery estimate can be recalculated later
    @Column(name = "shipping_option_id", length = 40)
    private String shippingOptionId;

    @Column(name = "estimated_delivery_at")
    private LocalDateTime estimatedDeliveryAt;

    /** AUTO when the platform rule set the date, ADMIN when an administrator overrode it. */
    @Column(name = "estimated_delivery_source", length = 20)
    private String estimatedDeliverySource;

    @Column(name = "estimated_delivery_note", length = 200)
    private String estimatedDeliveryNote;

    @Column(name = "shipped_at")
    private LocalDateTime shippedAt;

    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
