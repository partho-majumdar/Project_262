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
 * Seller/admin view of a proxy auction: the public fields plus the ones only the lot owner and
 * admins may see.
 * <p>
 * The reserve price lives here and <b>only</b> here. {@link AuctionDto} exposes {@code hasReserve}
 * and {@code reserveMet} instead, so a bidder can never read the figure. The winner is identified
 * to the seller by name and email, which is the seller's own customer, not the public.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SellerAuctionDto {

    private UUID id;

    private UUID productId;
    private String productName;
    private String productSlug;
    private String productImageUrl;

    private UUID sellerStoreId;
    private String sellerStoreName;

    private String description;
    private AuctionStatus status;

    private int quantity;
    private BigDecimal startingPrice;
    private BigDecimal currentPrice;
    private BigDecimal minimumBidIncrement;
    private BigDecimal minimumNextBid;
    /** Private to the owning seller and admins. */
    private BigDecimal reservePrice;
    private boolean reserveMet;

    private int bidCount;
    private int bidderCount;

    private LocalDateTime startsAt;
    private LocalDateTime endsAt;
    private LocalDateTime serverTime;
    private long timeRemainingSeconds;
    private boolean acceptingBids;

    private UUID winnerBidId;
    private String winnerName;
    private String winnerEmail;
    private BigDecimal finalPrice;
    private UUID winnerOrderId;
    private String winnerOrderNumber;
    private int unitsSold;

    private String closeCode;
    private String closeCodeLabel;
    private String closeNote;
    private LocalDateTime endedAt;
    private boolean inventoryReserved;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
