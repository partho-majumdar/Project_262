package com.groupmart.dto.groupr;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.groupmart.entity.GroupReverseDemandStatus;

/**
 * A group reverse demand as any member or browsing customer may see it.
 * <p>
 * Deliberately thin on member detail: the group needs to advertise its size, its price target and
 * its progress, not the identities of the people in it. Individual members are only ever listed
 * through {@link GroupReverseMemberDto} on the leader's own view.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupReverseDemandDto {

    private UUID id;
    private UUID productId;
    private String productName;
    private String productImageUrl;
    private BigDecimal productPrice;

    private UUID leaderId;
    /** The leader's display name, for "started by ...". Never an email or phone number. */
    private String leaderName;

    private GroupReverseDemandStatus status;
    private String statusLabel;
    private String description;

    private int requiredQuantity;
    private int committedQuantity;
    private int remainingQuantity;
    private int progressPercent;
    private int memberCount;
    private int offerCount;

    private BigDecimal targetPrice;
    private BigDecimal maxPrice;
    private int minQuantityPerMember;
    private int maxQuantityPerMember;

    private LocalDateTime joinDeadline;
    private LocalDateTime offerDeadline;
    private String deliveryCity;
    private LocalDate requiredDeliveryDate;

    /** Server clock plus server-computed remaining time, so a skewed browser cannot fake a deadline. */
    private LocalDateTime serverTime;
    private long timeToJoinDeadlineSeconds;
    private long timeToOfferDeadlineSeconds;

    private boolean canJoin;
    private boolean acceptingOffers;
    /** True when the signed-in customer is the creator and therefore the only one who may select. */
    private boolean leader;
    /** The signed-in customer's own membership, when they have one. */
    private GroupReverseMemberDto myMembership;

    // ---- The locked outcome, public once a seller has been selected ----
    private UUID selectedOfferId;
    private String selectedSellerStoreName;
    private BigDecimal lockedUnitPrice;
    private BigDecimal lockedDeliveryFee;
    private Integer lockedEstimatedDeliveryDays;
    private Integer lockedWarrantyMonths;
    private BigDecimal finalGroupTotal;

    private UUID selectedSellerStoreId;
    private String closeCode;
    private String closeNote;
    private LocalDateTime publishedAt;
    private LocalDateTime targetReachedAt;
    private LocalDateTime offerSelectedAt;
    private LocalDateTime closedAt;
    private LocalDateTime createdAt;
}
