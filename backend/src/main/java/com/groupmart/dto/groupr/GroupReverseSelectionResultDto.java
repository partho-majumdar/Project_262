package com.groupmart.dto.groupr;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The outcome of locking in a seller's offer: the demand, the winning offer, and the individual
 * orders that were generated from it.
 * <p>
 * Returned once at selection so the leader can confirm the fan-out immediately, rather than making
 * them reassemble it from a members list.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupReverseSelectionResultDto {

    private GroupReverseDemandDto demand;
    private GroupReverseOfferDto selectedOffer;
    /** One entry per member, in the same order the orders were created. */
    private List<GeneratedOrder> orders;
    private int orderCount;
    private int totalUnits;
    private BigDecimal grandTotal;
    private String note;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GeneratedOrder {
        private UUID memberId;
        private UUID customerId;
        private String customerName;
        private int quantity;
        private BigDecimal unitPrice;
        private BigDecimal deliveryFeeShare;
        private BigDecimal total;
        private UUID orderId;
        private String orderNumber;
    }
}
