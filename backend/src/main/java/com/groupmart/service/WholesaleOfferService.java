package com.groupmart.service;

import com.groupmart.dto.wholesale.WholesaleOfferDto;
import com.groupmart.dto.wholesale.WholesaleOfferRequest;
import com.groupmart.dto.wholesale.WholesalePoolDto;

import java.util.List;
import java.util.UUID;

/**
 * Seller offer management for Collaborative Wholesale Purchasing offers. Sellers create, edit and
 * activate their own offers directly - there is no admin approval step. Admins retain moderation
 * powers (viewing all offers, force-closing or cancelling a misbehaving one).
 */
public interface WholesaleOfferService {

    List<WholesaleOfferDto> getSellerOffers(String sellerEmail);

    WholesaleOfferDto getSellerOffer(String sellerEmail, UUID offerId);

    WholesaleOfferDto createOffer(String sellerEmail, WholesaleOfferRequest request);

    WholesaleOfferDto updateOffer(String sellerEmail, UUID offerId, WholesaleOfferRequest request);

    /** Activates a draft offer directly: sellers manage their own wholesale offers, no admin approval needed. */
    WholesaleOfferDto activateOffer(String sellerEmail, UUID offerId);

    WholesaleOfferDto pauseOffer(String sellerEmail, UUID offerId);

    WholesaleOfferDto resumeOffer(String sellerEmail, UUID offerId);

    WholesaleOfferDto cancelOffer(String sellerEmail, UUID offerId, String reason);

    List<WholesalePoolDto> getSellerOfferPools(String sellerEmail, UUID offerId);

    List<WholesaleOfferDto> getAllOffers(String status);

    WholesaleOfferDto getOfferForAdmin(UUID offerId);

    WholesaleOfferDto forceCloseOffer(String adminEmail, UUID offerId, String reason);

    WholesaleOfferDto adminCancelOffer(String adminEmail, UUID offerId, String reason);

    /**
     * Closes an offer whose reservation deadline has passed, so it stops presenting itself as live.
     * Idempotent: an offer that is already closed is left alone.
     */
    void closeExpiredOffer(UUID offerId);
}
