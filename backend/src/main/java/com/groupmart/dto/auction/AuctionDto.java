package com.groupmart.dto.auction;

import com.groupmart.entity.AuctionStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Public view of a proxy auction. Safe for anyone, signed in or not.
 * <p>
 * Deliberately carries no reserve price (only {@code hasReserve}/{@code reserveMet}) and nothing
 * that could identify a bidder's private ceiling: {@code currentPrice} is the engine's public
 * figure, and no maximum bid is ever mapped here.
 * <p>
 * Distinct from {@link GroupBuyingAuctionDto}, which is the collective-quantity mechanism.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuctionDto {

    private UUID id;

    private UUID productId;
    private String productName;
    private String productSlug;
    private String productImageUrl;
    private String productDescription;
    private BigDecimal productPrice;

    private UUID sellerStoreId;
    private String sellerStoreName;
    private String sellerStoreSlug;

    private String description;
    private AuctionStatus status;

    private int quantity;
    private BigDecimal startingPrice;
    /** The public price: the least that beats the runner-up, capped by the leader's ceiling. */
    private BigDecimal currentPrice;
    private BigDecimal minimumBidIncrement;
    /** What a new bidder must authorise at least. Computed by the server. */
    private BigDecimal minimumNextBid;

    private int bidCount;
    private int bidderCount;

    /** Whether the seller set a reserve. The value itself is never disclosed. */
    private boolean hasReserve;
    private boolean reserveMet;

    private LocalDateTime startsAt;
    private LocalDateTime endsAt;
    /** Server clock, so the browser can correct its own and never trust local time. */
    private LocalDateTime serverTime;
    /** Whole seconds left, calculated server-side. */
    private long timeRemainingSeconds;
    private boolean acceptingBids;

    /** Winner is public only as a pseudonymous alias, never as a name or email. */
    private UUID winnerBidId;
    private String winnerAlias;
    private BigDecimal finalPrice;

    private String closeCode;
    private String closeCodeLabel;
    private String closeNote;
    private LocalDateTime endedAt;
}
