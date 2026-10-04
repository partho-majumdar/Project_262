package com.groupmart.dto.auction;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.groupmart.entity.AuctionPricingRule;

/** The locked outcome of a finalized auction. Once written, its final price never changes. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuctionResultDto {

    private UUID id;
    private UUID auctionId;
    private UUID productId;
    private String productName;
    private AuctionPricingRule pricingRule;
    private BigDecimal finalUnitPrice;
    private BigDecimal startingPriceAtFinalization;
    private int collectiveQuantity;
    private int bidderCount;
    private int winningBidCount;
    private int outbidCount;
    /** Units actually sold. Lower than {@link #collectiveQuantity} whenever anyone is outbid. */
    private int winningQuantity;
    /** Units lost by outbid bidders and returned to sellable stock. */
    private int outbidQuantity;
    /** Revenue from the winning orders only, at the locked clearing price. */
    private BigDecimal totalSuccessfulSales;
    private BigDecimal minimumSellerUnitPrice;
    private LocalDateTime finalizedAt;
    private String finalizedByName;
}
