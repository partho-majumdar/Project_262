package com.groupmart.service;

import java.util.List;
import java.util.UUID;

import com.groupmart.dto.groupr.GroupReverseDemandDto;
import com.groupmart.dto.groupr.GroupReverseOfferDto;
import com.groupmart.dto.groupr.GroupReverseSelectionResultDto;
import com.groupmart.dto.groupr.SubmitGroupReverseOfferRequest;

/**
 * The competitive seller round: sellers bid to fulfil a group, the group's creator picks the winner.
 * <p>
 * Nothing here ranks or auto-selects. The leader's explicit {@link #selectOffer} call is the only
 * path to a locked price.
 */
public interface GroupReverseOfferService {

    /**
     * Submits a competing offer against a demand that has reached its target and is accepting offers.
     * <p>
     * The offer must cover the whole group quantity and must not exceed the creator's stated maximum
     * price, so the leader is never handed a choice their own demand already rules out.
     */
    GroupReverseOfferDto submitOffer(String sellerEmail, UUID demandId, SubmitGroupReverseOfferRequest request);

    /** Revises a still-SUBMITTED offer. Refused once the offer has been accepted. */
    GroupReverseOfferDto reviseOffer(String sellerEmail, UUID offerId, SubmitGroupReverseOfferRequest request);

    GroupReverseOfferDto withdrawOffer(String sellerEmail, UUID offerId);

    /** The leader's comparison list for one demand. Other members cannot read the offers. */
    List<GroupReverseOfferDto> getOffersForDemand(String requesterEmail, UUID demandId);

    /** A seller's own offers across every demand, with their outcomes. */
    List<GroupReverseOfferDto> getMyOffers(String sellerEmail);

    /**
     * The leader locks in one seller's offer: the price and every member quantity freeze, the other
     * offers close, and one individual order per member is generated.
     */
    GroupReverseSelectionResultDto selectOffer(String leaderEmail, UUID demandId, UUID offerId);

    /** Demands this seller is currently eligible to bid on. */
    List<GroupReverseDemandDto> getAvailableDemands(String sellerEmail);
}
