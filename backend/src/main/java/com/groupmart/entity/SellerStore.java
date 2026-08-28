package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "seller_stores")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SellerStore {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "store_name", nullable = false, unique = true, length = 150)
    private String storeName;

    @Column(name = "store_slug", nullable = false, unique = true, length = 180)
    private String storeSlug;

    @Column(name = "description", length = 1500)
    private String description;

    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    @Column(name = "banner_url", length = 500)
    private String bannerUrl;

    @Column(name = "tax_id", length = 100)
    private String taxId;

    @Column(name = "verified", nullable = false)
    @Builder.Default
    private boolean verified = false;

    @Column(name = "rating", nullable = false)
    @Builder.Default
    private double rating = 0.0;

    @Column(name = "total_sales", nullable = false)
    @Builder.Default
    private int totalSales = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "bank_account", length = 100)
    private String bankAccount;

    @Column(name = "bank_name", length = 150)
    private String bankName;

    @Column(name = "shipping_policy", length = 2000)
    private String shippingPolicy;

    @Column(name = "return_policy", length = 2000)
    private String returnPolicy;
}
