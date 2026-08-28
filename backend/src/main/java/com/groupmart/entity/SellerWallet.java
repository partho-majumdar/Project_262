package com.groupmart.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "seller_wallets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SellerWallet {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_store_id", nullable = false, unique = true)
    private SellerStore sellerStore;

    @Column(name = "available_balance", nullable = false, precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal availableBalance = BigDecimal.ZERO;

    @Column(name = "pending_balance", nullable = false, precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal pendingBalance = BigDecimal.ZERO;

    @Column(name = "total_earned", nullable = false, precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal totalEarned = BigDecimal.ZERO;

    @Column(name = "total_paid_out", nullable = false, precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal totalPaidOut = BigDecimal.ZERO;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
