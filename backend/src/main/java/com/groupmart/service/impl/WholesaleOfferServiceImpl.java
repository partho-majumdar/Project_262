package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.notification.SendNotificationRequest;
import com.groupmart.dto.wholesale.WholesaleOfferDto;
import com.groupmart.dto.wholesale.WholesaleOfferRequest;
import com.groupmart.dto.wholesale.WholesalePoolDto;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.NotificationService;
import com.groupmart.service.WholesaleOfferService;
import com.groupmart.service.WholesalePoolService;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WholesaleOfferServiceImpl implements WholesaleOfferService {

    private static final String SELLER_LINK = "/seller/dashboard?tab=wholesale";

    private final WholesaleOfferRepository offerRepository;
    private final WholesalePoolRepository poolRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final SellerStoreRepository sellerStoreRepository;
    private final WholesalePoolService poolService;
    private final NotificationService notificationService;
    private final WholesaleMapper mapper;

    // ----- Seller ------------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<WholesaleOfferDto> getSellerOffers(String sellerEmail) {
        SellerStore store = requireStore(sellerEmail);
        return offerRepository.findBySellerStoreIdOrderByCreatedAtDesc(store.getId()).stream()
                .map(mapper::toOfferDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public WholesaleOfferDto getSellerOffer(String sellerEmail, UUID offerId) {
        return mapper.toOfferDto(requireOwnedOffer(requireStore(sellerEmail), offerId));
    }

    @Override
    @Transactional
    public WholesaleOfferDto createOffer(String sellerEmail, WholesaleOfferRequest request) {
        SellerStore store = requireStore(sellerEmail);
        Product product = requireOwnedProduct(store, request.getProductId());
        validateRequest(request, product);

        WholesaleOffer offer = WholesaleOffer.builder()
                .product(product)
                .sellerStore(store)
                .status(WholesaleOfferStatus.DRAFT)
                .build();
        applyRequest(offer, request);
        return mapper.toOfferDto(offerRepository.save(offer));
    }

    @Override
    @Transactional
    public WholesaleOfferDto updateOffer(String sellerEmail, UUID offerId, WholesaleOfferRequest request) {
        SellerStore store = requireStore(sellerEmail);
        WholesaleOffer offer = requireOwnedOffer(store, offerId);
        if (offer.getStatus() != WholesaleOfferStatus.DRAFT) {
            throw bad("Only draft offers can be edited");
        }
        Product product = requireOwnedProduct(store, request.getProductId());
        validateRequest(request, product);

        offer.setProduct(product);
        applyRequest(offer, request);
        return mapper.toOfferDto(offerRepository.save(offer));
    }

    @Override
    @Transactional
    public WholesaleOfferDto activateOffer(String sellerEmail, UUID offerId) {
        WholesaleOffer offer = requireOwnedOffer(requireStore(sellerEmail), offerId);
        if (offer.getStatus() != WholesaleOfferStatus.DRAFT) {
            throw bad("Only draft offers can be activated");
        }
        LocalDateTime now = LocalDateTime.now();
        if (!offer.getReservationDeadline().isAfter(now)) {
            throw bad("This offer's reservation deadline has passed. Update it before activating.");
        }
        Integer stock = productRepository.findStockQuantityById(offer.getProduct().getId());
        if (stock == null || stock < offer.getMaxAvailableQuantity()) {
            throw bad("The product has only " + (stock == null ? 0 : stock)
                    + " unit(s) in stock but the offer needs " + offer.getMaxAvailableQuantity());
        }

        offer.setApprovedAt(now);
        offer.setStatus(WholesaleOfferStatus.ACTIVE);
        ensureOpenPool(offer);
        notify(offer.getSellerStore().getUser(), "Wholesale offer live",
                "Your wholesale offer for '" + shortText(offer.getProduct().getName(), 80)
                        + "' is now live and accepting reservations.", SELLER_LINK);
        return mapper.toOfferDto(offer);
    }

    @Override
    @Transactional
    public WholesaleOfferDto pauseOffer(String sellerEmail, UUID offerId) {
        WholesaleOffer offer = requireOwnedOffer(requireStore(sellerEmail), offerId);
        if (offer.getStatus() != WholesaleOfferStatus.ACTIVE) {
            throw bad("Only active offers can be paused");
        }
        // Pausing an offer whose deadline has passed would strand it: resumeOffer rejects an expired
        // offer, so the seller could never restart or reopen it. Refuse instead of trapping them.
        if (!offer.getReservationDeadline().isAfter(LocalDateTime.now())) {
            throw bad("This offer's reservation deadline has already passed, so it can no longer be paused");
        }
        offer.setStatus(WholesaleOfferStatus.PAUSED);
        return mapper.toOfferDto(offer);
    }

    @Override
    @Transactional
    public WholesaleOfferDto resumeOffer(String sellerEmail, UUID offerId) {
        WholesaleOffer offer = requireOwnedOffer(requireStore(sellerEmail), offerId);
        if (offer.getStatus() != WholesaleOfferStatus.PAUSED) {
            throw bad("Only paused offers can be resumed");
        }
        if (!offer.getReservationDeadline().isAfter(LocalDateTime.now())) {
            throw bad("This offer's reservation deadline has already passed");
        }
        offer.setStatus(WholesaleOfferStatus.ACTIVE);
        ensureOpenPool(offer);
        return mapper.toOfferDto(offer);
    }

    @Override
    @Transactional
    public WholesaleOfferDto cancelOffer(String sellerEmail, UUID offerId, String reason) {
        WholesaleOffer offer = requireOwnedOffer(requireStore(sellerEmail), offerId);
        if (offer.getStatus().isTerminal()) {
            throw bad("This offer has already ended");
        }
        offer.setStatus(WholesaleOfferStatus.CANCELLED);
        offer.setClosedAt(LocalDateTime.now());
        return mapper.toOfferDto(offer);
    }

    @Override
    @Transactional(readOnly = true)
    public List<WholesalePoolDto> getSellerOfferPools(String sellerEmail, UUID offerId) {
        requireOwnedOffer(requireStore(sellerEmail), offerId);
        return poolRepository.findByOfferIdOrderByLotNumberDesc(offerId).stream()
                .map(mapper::toPoolDto)
                .toList();
    }

    // ----- Admin -------------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<WholesaleOfferDto> getAllOffers(String status) {
        List<WholesaleOffer> offers = status == null || status.isBlank()
                ? offerRepository.findAll()
                : offerRepository.findByStatusOrderByCreatedAtDesc(parseStatus(status));
        return offers.stream().map(mapper::toOfferDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public WholesaleOfferDto getOfferForAdmin(UUID offerId) {
        return mapper.toOfferDto(requireOffer(offerId));
    }

    @Override
    @Transactional
    public WholesaleOfferDto forceCloseOffer(String adminEmail, UUID offerId, String reason) {
        WholesaleOffer offer = requireOffer(offerId);
        if (offer.getStatus().isTerminal()) {
            throw bad("This offer has already ended");
        }
        offer.setStatus(WholesaleOfferStatus.CLOSED);
        offer.setClosedAt(LocalDateTime.now());
        notify(offer.getSellerStore().getUser(), "Wholesale offer closed",
                "An administrator closed your wholesale offer for '"
                        + shortText(offer.getProduct().getName(), 80) + "'. Reason: "
                        + reasonOrDefault(reason, "Not recorded"), SELLER_LINK);
        return mapper.toOfferDto(offer);
    }

    @Override
    @Transactional
    public WholesaleOfferDto adminCancelOffer(String adminEmail, UUID offerId, String reason) {
        WholesaleOffer offer = requireOffer(offerId);
        if (offer.getStatus().isTerminal()) {
            throw bad("This offer has already ended");
        }
        offer.setStatus(WholesaleOfferStatus.CANCELLED);
        offer.setClosedAt(LocalDateTime.now());
        notify(offer.getSellerStore().getUser(), "Wholesale offer cancelled",
                "An administrator cancelled your wholesale offer for '"
                        + shortText(offer.getProduct().getName(), 80) + "'. Reason: "
                        + reasonOrDefault(reason, "Not recorded"), SELLER_LINK);
        return mapper.toOfferDto(offer);
    }

    @Override
    @Transactional
    public void closeExpiredOffer(UUID offerId) {
        WholesaleOffer offer = requireOffer(offerId);
        if (offer.getStatus().isTerminal()) {
            return; // already closed, cancelled or failed
        }
        if (offer.getReservationDeadline().isAfter(LocalDateTime.now())) {
            return; // no longer actually expired
        }
        offer.setStatus(WholesaleOfferStatus.CLOSED);
        offer.setClosedAt(LocalDateTime.now());
        offer.setCloseCode(WholesaleCloseCode.DEADLINE_REACHED);
        notify(offer.getSellerStore().getUser(), "Wholesale offer closed",
                "Your wholesale offer for '" + shortText(offer.getProduct().getName(), 80)
                        + "' reached its reservation deadline and has closed.", SELLER_LINK);
    }

    // ----- Helpers -----------------------------------------------------------------------------

    /** Opens lot #1 the first time an offer goes active; later activations (resume) leave existing open lots alone. */
    private void ensureOpenPool(WholesaleOffer offer) {
        boolean hasOpenPool = poolRepository.findByOfferIdOrderByLotNumberDesc(offer.getId()).stream()
                .anyMatch(pool -> pool.getStatus().acceptsReservations());
        if (!hasOpenPool) {
            poolService.openPoolForOffer(offer);
        }
    }

    private void validateRequest(WholesaleOfferRequest request, Product product) {
        if (!product.isActive()) {
            throw bad("Only active products can be used for wholesale offers");
        }
        if (request.getMaxQuantityPerCustomer() < request.getMinQuantityPerCustomer()) {
            throw bad("Maximum quantity per customer must be greater than or equal to the minimum");
        }
        if (request.getMaxQuantityPerCustomer() > request.getWholesaleMinimumQuantity()) {
            throw bad("Maximum quantity per customer cannot exceed the wholesale minimum quantity");
        }
        if (request.getWholesaleMinimumQuantity() > request.getMaxAvailableQuantity()) {
            throw bad("Wholesale minimum quantity cannot exceed the maximum available quantity");
        }
        if (!request.getReservationDeadline().isAfter(LocalDateTime.now())) {
            throw bad("Reservation deadline must be in the future");
        }
        if (request.getWholesaleUnitPrice().compareTo(product.getPrice()) >= 0) {
            throw bad("Wholesale unit price must be lower than the regular product price");
        }
        if (request.getMaxAvailableQuantity() > product.getStockQuantity()) {
            throw bad("Only " + product.getStockQuantity() + " unit(s) of this product are in stock");
        }
    }

    private void applyRequest(WholesaleOffer offer, WholesaleOfferRequest request) {
        offer.setMode(request.getMode());
        offer.setWholesaleUnitPrice(request.getWholesaleUnitPrice());
        offer.setWholesaleMinimumQuantity(request.getWholesaleMinimumQuantity());
        offer.setMaxAvailableQuantity(request.getMaxAvailableQuantity());
        offer.setMinQuantityPerCustomer(request.getMinQuantityPerCustomer());
        offer.setMaxQuantityPerCustomer(request.getMaxQuantityPerCustomer());
        offer.setReservationDeadline(request.getReservationDeadline());
        offer.setExpectedFulfillmentNote(request.getExpectedFulfillmentNote());
        offer.setDeliveryConditions(request.getDeliveryConditions());
        offer.setAutoReopenNewLot(request.isAutoReopenNewLot());
    }

    private SellerStore requireStore(String sellerEmail) {
        User user = userRepository.findByEmail(sellerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", sellerEmail));
        return sellerStoreRepository.findByUserId(user.getId())
                .orElseThrow(() -> bad("Create your seller store before running wholesale offers"));
    }

    private Product requireOwnedProduct(SellerStore store, UUID productId) {
        return productRepository.findById(productId)
                .filter(p -> p.getSellerStore() != null && p.getSellerStore().getId().equals(store.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", productId));
    }

    private WholesaleOffer requireOwnedOffer(SellerStore store, UUID offerId) {
        return offerRepository.findById(offerId)
                .filter(o -> o.getSellerStore().getId().equals(store.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("WholesaleOffer", "id", offerId));
    }

    private WholesaleOffer requireOffer(UUID offerId) {
        return offerRepository.findById(offerId)
                .orElseThrow(() -> new ResourceNotFoundException("WholesaleOffer", "id", offerId));
    }

    private WholesaleOfferStatus parseStatus(String status) {
        try {
            return WholesaleOfferStatus.valueOf(status.trim().toUpperCase());
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
                .type("WHOLESALE_OFFER")
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
