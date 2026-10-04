package com.groupmart.service;

import java.util.List;
import java.util.UUID;

import com.groupmart.dto.reverse.ReverseGroupBuyingCampaignDto;
import com.groupmart.dto.reverse.ReverseGroupBuyingOfferDto;
import com.groupmart.dto.reverse.ReverseGroupBuyingOfferRequest;
import com.groupmart.dto.reverse.ReverseGroupBuyingParticipationDto;
import com.groupmart.entity.ReverseGroupBuyingCloseCode;
import com.groupmart.entity.ReverseGroupBuyingOffer;

/**
 * Seller management of Reverse Group Buying offers, plus the public read model for the
 * Reverse Group Buying marketplace. Independent of the CWP offer service.
 */
public interface ReverseGroupBuyingOfferService {

    // ----- Seller ------------------------------------------------------------------------------

    List<ReverseGroupBuyingOfferDto> getSellerOffers(String sellerEmail);

    ReverseGroupBuyingOfferDto getSellerOffer(String sellerEmail, UUID offerId);

    ReverseGroupBuyingOfferDto createOffer(String sellerEmail, ReverseGroupBuyingOfferRequest request);

    ReverseGroupBuyingOfferDto updateOffer(String sellerEmail, UUID offerId, ReverseGroupBuyingOfferRequest request);

    /** Publishes a draft: validates the deadline and stock, then opens it for customer demand. */
    ReverseGroupBuyingOfferDto activateOffer(String sellerEmail, UUID offerId);

    /** Ends an open offer before its target was reached; active participations are refunded. */
    ReverseGroupBuyingOfferDto closeOffer(String sellerEmail, UUID offerId, String note);

    /** Moves an activated offer into fulfillment. */
    ReverseGroupBuyingOfferDto startFulfillment(String sellerEmail, UUID offerId);

    /** Marks every individual order of this offer as delivered. */
    ReverseGroupBuyingOfferDto completeOffer(String sellerEmail, UUID offerId);

    List<ReverseGroupBuyingParticipationDto> getSellerOfferParticipations(String sellerEmail, UUID offerId);

    // ----- Marketplace -------------------------------------------------------------------------

    List<ReverseGroupBuyingOfferDto> getMarketplaceOffers();

    ReverseGroupBuyingOfferDto getPublicOffer(UUID offerId);

    // ----- Campaign ----------------------------------------------------------------------------

    ReverseGroupBuyingCampaignDto getCampaignForOffer(UUID offerId);

    // ----- Admin -------------------------------------------------------------------------------

    List<ReverseGroupBuyingOfferDto> getAllOffers(String status);

    ReverseGroupBuyingOfferDto forceCloseOffer(String adminEmail, UUID offerId, String note);

    /** Locks the offer row so concurrent participations serialize on it. */
    ReverseGroupBuyingOffer lockOffer(UUID offerId);

    /** Shared with the scheduler; a no-op once the deadline has not actually passed. */
    void expireOfferIfDue(UUID offerId, ReverseGroupBuyingCloseCode fallbackCloseCode);
}
