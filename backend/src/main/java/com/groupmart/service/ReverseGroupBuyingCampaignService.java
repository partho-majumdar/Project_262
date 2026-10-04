package com.groupmart.service;

import java.util.List;
import java.util.UUID;

import com.groupmart.dto.reverse.ReverseGroupBuyingCampaignDto;
import com.groupmart.entity.ReverseGroupBuyingCloseCode;
import com.groupmart.entity.ReverseGroupBuyingOffer;

/**
 * The collective half of Reverse Group Buying: it decides when the seller's target condition has
 * been met, unlocks the purchasing condition, and generates the individual customer orders.
 * <p>
 * Deliberately separate from the CWP purchase service - it never touches a WholesalePool, a
 * WholesaleReservation or a wholesale price.
 */
public interface ReverseGroupBuyingCampaignService {

    ReverseGroupBuyingCampaignDto getCampaignForOffer(UUID offerId);

    /**
     * Re-evaluates an offer's target condition after its collective demand changed and, the first
     * time the condition is met, unlocks the purchasing condition and creates one individual order
     * per participation.
     * <p>
     * Must be called with the offer row already locked (PESSIMISTIC_WRITE) inside the caller's
     * transaction, and it runs in that same transaction, so activation and order generation are
     * atomic with the participation that triggered them.
     *
     * @return true when this call performed the activation
     */
    boolean syncProgress(ReverseGroupBuyingOffer lockedOffer);

    /**
     * Ends an offer before its target condition was met: every still-active participation is
     * refunded and its quantity released back to sellable stock.
     */
    void closeAndRefund(ReverseGroupBuyingOffer lockedOffer, ReverseGroupBuyingCloseCode closeCode, String note);

    /** Every participation still counted toward the target condition, oldest first. */
    List<UUID> activeParticipationIds(ReverseGroupBuyingOffer offer);
}
