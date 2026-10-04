package com.groupmart.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.notification.SendNotificationRequest;
import com.groupmart.dto.reverse.*;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.NotificationService;
import com.groupmart.service.ReverseGroupBuyingCampaignService;
import com.groupmart.service.ReverseGroupBuyingOfferService;

/**
 * Seller management of Reverse Group Buying offers, and the public marketplace read model.
 * <p>
 * Nothing here touches the CWP offer/pool machinery: a Reverse Group Buying offer is configured
 * around a seller-defined target condition, not around a wholesale minimum and wholesale price.
 */
@Service
@RequiredArgsConstructor
public class ReverseGroupBuyingOfferServiceImpl implements ReverseGroupBuyingOfferService {

    private static final String SELLER_LINK = "/seller/dashboard?tab=reverse-group-buying";

    private final ReverseGroupBuyingOfferRepository offerRepository;
    private final ReverseGroupBuyingParticipationRepository participationRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final SellerStoreRepository sellerStoreRepository;
    private final ReverseGroupBuyingCampaignService campaignService;
    private final NotificationService notificationService;
    private final ReverseGroupBuyingMapper mapper;

    // ----- Seller ------------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<ReverseGroupBuyingOfferDto> getSellerOffers(String sellerEmail) {
        SellerStore store = requireStore(sellerEmail);
        return offerRepository.findBySellerStoreIdOrderByCreatedAtDesc(store.getId()).stream()
                .map(mapper::toOfferDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ReverseGroupBuyingOfferDto getSellerOffer(String sellerEmail, UUID offerId) {
        return mapper.toOfferDto(requireOwnedOffer(requireStore(sellerEmail), offerId));
    }

    @Override
    @Transactional
    public ReverseGroupBuyingOfferDto createOffer(String sellerEmail, ReverseGroupBuyingOfferRequest request) {
        SellerStore store = requireStore(sellerEmail);
        Product product = requireOwnedProduct(store, request.getProductId());
        validateRequest(request, product);

        ReverseGroupBuyingOffer offer = ReverseGroupBuyingOffer.builder()
                .product(product)
                .sellerStore(store)
                .basePrice(product.getPrice())
                .status(ReverseGroupBuyingOfferStatus.DRAFT)
                .build();
        applyRequest(offer, request, product.getPrice());
        return mapper.toOfferDto(offerRepository.save(offer));
    }

    @Override
    @Transactional
    public ReverseGroupBuyingOfferDto updateOffer(String sellerEmail, UUID offerId, ReverseGroupBuyingOfferRequest request) {
        SellerStore store = requireStore(sellerEmail);
        ReverseGroupBuyingOffer offer = requireOwnedOffer(store, offerId);
        if (offer.getStatus() != ReverseGroupBuyingOfferStatus.DRAFT) {
            throw bad("Only draft offers can be edited");
        }
        Product product = requireOwnedProduct(store, request.getProductId());
        validateRequest(request, product);

        offer.setProduct(product);
        applyRequest(offer, request, product.getPrice());
        return mapper.toOfferDto(offerRepository.save(offer));
    }

    @Override
    @Transactional
    public ReverseGroupBuyingOfferDto activateOffer(String sellerEmail, UUID offerId) {
        SellerStore store = requireStore(sellerEmail);
        ReverseGroupBuyingOffer offer = offerRepository.findByIdForUpdate(offerId)
                .filter(o -> o.getSellerStore().getId().equals(store.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("ReverseGroupBuyingOffer", "id", offerId));

        if (offer.getStatus() != ReverseGroupBuyingOfferStatus.DRAFT) {
            throw bad("Only draft offers can be activated");
        }
        if (!offer.getParticipationDeadline().isAfter(LocalDateTime.now())) {
            throw bad("This offer's participation deadline has passed. Update it before activating.");
        }
        if (offer.getTargetQuantity() > offer.getAvailableQuantity()) {
            throw bad("The target of " + offer.getTargetQuantity() + " units cannot exceed the available quantity of "
                    + offer.getAvailableQuantity());
        }
        Integer stock = productRepository.findStockQuantityById(offer.getProduct().getId());
        if (stock == null || stock < offer.getAvailableQuantity()) {
            throw bad("The product has only " + (stock == null ? 0 : stock) + " unit(s) in stock but this offer needs "
                    + offer.getAvailableQuantity());
        }

        offer.setStatus(ReverseGroupBuyingOfferStatus.OPEN);
        offerRepository.save(offer);

        notify(store.getUser(), "Reverse group buying offer live",
                "Your reverse group buying offer for '" + shortText(offer.getProduct().getName(), 80)
                        + "' is now collecting customer demand towards " + offer.getTargetQuantity() + " units.", SELLER_LINK);
        return mapper.toOfferDto(offer);
    }

    @Override
    @Transactional
    public ReverseGroupBuyingOfferDto closeOffer(String sellerEmail, UUID offerId, String note) {
        SellerStore store = requireStore(sellerEmail);
        ReverseGroupBuyingOffer offer = offerRepository.findByIdForUpdate(offerId)
                .filter(o -> o.getSellerStore().getId().equals(store.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("ReverseGroupBuyingOffer", "id", offerId));

        if (offer.getStatus().isTerminal()) {
            throw bad("This offer has already ended");
        }
        if (offer.getStatus().isActivatedOrBeyond()) {
            throw bad("The purchasing condition for this offer was already unlocked, so it can no longer be closed. "
                    + "Cancel the individual orders instead.");
        }
        campaignService.closeAndRefund(offer, ReverseGroupBuyingCloseCode.CLOSED_EARLY_BY_SELLER, note);
        return mapper.toOfferDto(offer);
    }

    @Override
    @Transactional
    public ReverseGroupBuyingOfferDto startFulfillment(String sellerEmail, UUID offerId) {
        SellerStore store = requireStore(sellerEmail);
        ReverseGroupBuyingOffer offer = requireOwnedOffer(store, offerId);
        if (offer.getStatus() != ReverseGroupBuyingOfferStatus.PROCESSING) {
            throw bad("Only an offer whose individual orders have been generated can move to fulfillment");
        }
        offer.setStatus(ReverseGroupBuyingOfferStatus.FULFILLMENT);
        return mapper.toOfferDto(offerRepository.save(offer));
    }

    @Override
    @Transactional
    public ReverseGroupBuyingOfferDto completeOffer(String sellerEmail, UUID offerId) {
        SellerStore store = requireStore(sellerEmail);
        ReverseGroupBuyingOffer offer = requireOwnedOffer(store, offerId);
        if (offer.getStatus() != ReverseGroupBuyingOfferStatus.FULFILLMENT) {
            throw bad("Only an offer in fulfillment can be completed");
        }
        offer.setStatus(ReverseGroupBuyingOfferStatus.COMPLETED);
        return mapper.toOfferDto(offerRepository.save(offer));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReverseGroupBuyingParticipationDto> getSellerOfferParticipations(String sellerEmail, UUID offerId) {
        SellerStore store = requireStore(sellerEmail);
        ReverseGroupBuyingOffer offer = requireOwnedOffer(store, offerId);
        return participationRepository.findByOfferIdOrderByCreatedAtAsc(offer.getId()).stream()
                .map(mapper::toParticipationDto)
                .toList();
    }

    // ----- Marketplace -------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<ReverseGroupBuyingOfferDto> getMarketplaceOffers() {
        return offerRepository.findOpenOffersForMarketplace().stream()
                .map(mapper::toOfferDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ReverseGroupBuyingOfferDto getPublicOffer(UUID offerId) {
        return mapper.toOfferDto(offerRepository.findDetailedById(offerId)
                .orElseThrow(() -> new ResourceNotFoundException("ReverseGroupBuyingOffer", "id", offerId)));
    }

    @Override
    @Transactional(readOnly = true)
    public ReverseGroupBuyingCampaignDto getCampaignForOffer(UUID offerId) {
        return campaignService.getCampaignForOffer(offerId);
    }

    // ----- Admin -------------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<ReverseGroupBuyingOfferDto> getAllOffers(String status) {
        List<ReverseGroupBuyingOffer> offers = status == null || status.isBlank()
                ? offerRepository.findAll()
                : offerRepository.findByStatusOrderByCreatedAtDesc(parseStatus(status));
        return offers.stream().map(mapper::toOfferDto).toList();
    }

    @Override
    @Transactional
    public ReverseGroupBuyingOfferDto forceCloseOffer(String adminEmail, UUID offerId, String note) {
        ReverseGroupBuyingOffer offer = offerRepository.findByIdForUpdate(offerId)
                .orElseThrow(() -> new ResourceNotFoundException("ReverseGroupBuyingOffer", "id", offerId));
        if (offer.getStatus().isTerminal()) {
            throw bad("This offer has already ended");
        }
        if (offer.getStatus().isActivatedOrBeyond()) {
            throw bad("The purchasing condition was already unlocked for this offer, so it cannot be force-closed");
        }
        campaignService.closeAndRefund(offer, ReverseGroupBuyingCloseCode.OTHER, note);
        notify(offer.getSellerStore().getUser(), "Reverse group buying offer closed",
                "An administrator closed your reverse group buying offer for '"
                        + shortText(offer.getProduct().getName(), 80) + "'. Reason: " + reasonOrDefault(note, "Not recorded"),
                SELLER_LINK);
        return mapper.toOfferDto(offer);
    }

    // ----- Locking / deadline ------------------------------------------------------------------

    @Override
    @Transactional
    public ReverseGroupBuyingOffer lockOffer(UUID offerId) {
        return offerRepository.findByIdForUpdate(offerId)
                .orElseThrow(() -> new ResourceNotFoundException("ReverseGroupBuyingOffer", "id", offerId));
    }

    @Override
    @Transactional
    public void expireOfferIfDue(UUID offerId, ReverseGroupBuyingCloseCode fallbackCloseCode) {
        ReverseGroupBuyingOffer offer = lockOffer(offerId);
        if (!offer.getStatus().acceptsDemand() || offer.getParticipationDeadline().isAfter(LocalDateTime.now())) {
            return; // already ended, or no longer actually expired
        }
        if (offer.isTargetReached()) {
            // Demand did reach the condition, but nobody activated it yet: unlock it now.
            campaignService.syncProgress(offer);
            return;
        }
        campaignService.closeAndRefund(offer,
                fallbackCloseCode != null ? fallbackCloseCode
                        : ReverseGroupBuyingCloseCode.DEADLINE_REACHED_BELOW_TARGET, null);
    }

    // ----- Validation / mapping ----------------------------------------------------------------

    private void validateRequest(ReverseGroupBuyingOfferRequest request, Product product) {
        if (!product.isActive()) {
            throw bad("Only active products can be used for reverse group buying offers");
        }
        if (request.getMaxQuantityPerCustomer() < request.getMinQuantityPerCustomer()) {
            throw bad("Maximum quantity per customer must be greater than or equal to the minimum");
        }
        if (request.getTargetQuantity() > request.getAvailableQuantity()) {
            throw bad("The target quantity cannot exceed the available quantity for this offer");
        }
        if (request.getMaxQuantityPerCustomer() > request.getAvailableQuantity()) {
            throw bad("Maximum quantity per customer cannot exceed the available quantity for this offer");
        }
        if (!request.getParticipationDeadline().isAfter(LocalDateTime.now())) {
            throw bad("Participation deadline must be in the future");
        }
        if (request.getAvailableQuantity() > product.getStockQuantity()) {
            throw bad("Only " + product.getStockQuantity() + " unit(s) of this product are in stock");
        }

        switch (request.getTargetType()) {
            case TARGET_QUANTITY, TARGET_PRICE -> {
                if (request.getTargetValue() != null) {
                    throw bad("Target value is only used with the DISCOUNT_THRESHOLD target type");
                }
                if (request.getUnlockedUnitPrice() == null) {
                    throw bad("An unlocked unit price is required for the " + request.getTargetType() + " target type");
                }
                if (request.getUnlockedUnitPrice().compareTo(product.getPrice()) >= 0) {
                    throw bad("The unlocked unit price must be lower than the regular product price of "
                            + product.getPrice());
                }
            }
            case DISCOUNT_THRESHOLD -> {
                if (request.getTargetValue() == null) {
                    throw bad("A discount percentage is required for the DISCOUNT_THRESHOLD target type");
                }
                BigDecimal unlocked = derivedUnlockedPrice(product.getPrice(), request.getTargetValue());
                if (request.getUnlockedUnitPrice() != null
                        && request.getUnlockedUnitPrice().compareTo(unlocked) != 0) {
                    throw bad("A " + request.getTargetValue().stripTrailingZeros().toPlainString()
                            + "% discount off " + product.getPrice() + " is " + unlocked
                            + ", which does not match the unlocked unit price you entered");
                }
            }
        }
    }

    private void applyRequest(ReverseGroupBuyingOffer offer, ReverseGroupBuyingOfferRequest request, BigDecimal productPrice) {
        offer.setDescription(request.getDescription());
        offer.setBasePrice(productPrice);
        offer.setTargetType(request.getTargetType());
        offer.setTargetValue(request.getTargetType() == ReverseTargetType.DISCOUNT_THRESHOLD
                ? request.getTargetValue() : null);
        offer.setTargetQuantity(request.getTargetQuantity());
        offer.setUnlockedUnitPrice(request.getTargetType() == ReverseTargetType.DISCOUNT_THRESHOLD
                ? derivedUnlockedPrice(productPrice, request.getTargetValue())
                : request.getUnlockedUnitPrice());
        offer.setAvailableQuantity(request.getAvailableQuantity());
        offer.setMinQuantityPerCustomer(request.getMinQuantityPerCustomer());
        offer.setMaxQuantityPerCustomer(request.getMaxQuantityPerCustomer());
        offer.setParticipationDeadline(request.getParticipationDeadline());
    }

    /** basePrice * (1 - percent/100), rounded to the stored 2-decimal money scale. */
    private static BigDecimal derivedUnlockedPrice(BigDecimal basePrice, BigDecimal percent) {
        BigDecimal factor = BigDecimal.ONE.subtract(percent.divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP));
        return basePrice.multiply(factor).setScale(2, RoundingMode.HALF_UP);
    }

    private SellerStore requireStore(String sellerEmail) {
        User user = userRepository.findByEmail(sellerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", sellerEmail));
        return sellerStoreRepository.findByUserId(user.getId())
                .orElseThrow(() -> bad("Create your seller store before running reverse group buying offers"));
    }

    private Product requireOwnedProduct(SellerStore store, UUID productId) {
        return productRepository.findById(productId)
                .filter(p -> p.getSellerStore() != null && p.getSellerStore().getId().equals(store.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", productId));
    }

    private ReverseGroupBuyingOffer requireOwnedOffer(SellerStore store, UUID offerId) {
        return offerRepository.findById(offerId)
                .filter(o -> o.getSellerStore().getId().equals(store.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("ReverseGroupBuyingOffer", "id", offerId));
    }

    private ReverseGroupBuyingOfferStatus parseStatus(String status) {
        try {
            return ReverseGroupBuyingOfferStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw bad("Unknown offer status: " + status);
        }
    }

    private void notify(User recipient, String title, String message, String link) {
        if (recipient == null) {
            return;
        }
        notificationService.sendNotification(SendNotificationRequest.builder()
                .userId(recipient.getId())
                .title(shortText(title, 150))
                .message(shortText(message, 1000))
                .type("REVERSE_GROUP_BUYING")
                .link(link)
                .build());
    }

    private static String reasonOrDefault(String reason, String fallback) {
        return reason != null && !reason.isBlank() ? reason.trim() : fallback;
    }

    private static String shortText(String text, int max) {
        if (text == null) {
            return null;
        }
        return text.length() <= max ? text : text.substring(0, max - 1) + "…";
    }

    private static ApiException bad(String message) {
        return new ApiException(message, HttpStatus.BAD_REQUEST);
    }
}
