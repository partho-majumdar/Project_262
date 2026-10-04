package com.groupmart.service.impl;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.auction.AuctionParticipationDto;
import com.groupmart.dto.auction.AuctionResultDto;
import com.groupmart.dto.auction.AuctionTierDto;
import com.groupmart.dto.auction.GroupBuyingAuctionDto;
import com.groupmart.dto.auction.GroupBuyingAuctionRequest;
import com.groupmart.dto.auction.GroupBuyingAuctionTierRequest;
import com.groupmart.dto.notification.SendNotificationRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.AuctionFinalizationService;
import com.groupmart.service.AuctionPricingService;
import com.groupmart.service.GroupBuyingAuctionService;
import com.groupmart.service.NotificationService;

/**
 * Seller management of Group Buying Auctions, and the public marketplace read model.
 * <p>
 * The seller configures the whole mechanism here - starting price, quantity limits, the auction
 * window and the pricing rule (including its tier ladder, validated by
 * {@link AuctionPricingService}) - but this class never computes a final price itself and never
 * touches CWP pools, reservations or wholesale prices.
 */
@Service
@RequiredArgsConstructor
public class GroupBuyingAuctionServiceImpl implements GroupBuyingAuctionService {

    private static final String SELLER_LINK = "/seller/dashboard?tab=group-buying-auctions";

    private final GroupBuyingAuctionRepository auctionRepository;
    private final GroupBuyingAuctionTierRepository tierRepository;
    private final GroupBuyingAuctionResultRepository resultRepository;
    private final GroupBuyingAuctionParticipationRepository participationRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final SellerStoreRepository sellerStoreRepository;
    private final AuctionPricingService pricingService;
    private final AuctionFinalizationService finalizationService;
    private final NotificationService notificationService;
    private final GroupBuyingAuctionMapper mapper;

    // ----- Seller ------------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<GroupBuyingAuctionDto> getSellerAuctions(String sellerEmail) {
        SellerStore store = requireStore(sellerEmail);
        return auctionRepository.findBySellerStoreIdOrderByCreatedAtDesc(store.getId()).stream()
                .map(mapper::toAuctionDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public GroupBuyingAuctionDto getSellerAuction(String sellerEmail, UUID auctionId) {
        return mapper.toAuctionDto(requireOwnedAuction(requireStore(sellerEmail), auctionId));
    }

    @Override
    @Transactional
    public GroupBuyingAuctionDto createAuction(String sellerEmail, GroupBuyingAuctionRequest request) {
        SellerStore store = requireStore(sellerEmail);
        Product product = requireOwnedProduct(store, request.getProductId());
        validateRequest(request, product);

        GroupBuyingAuction auction = GroupBuyingAuction.builder()
                .product(product)
                .sellerStore(store)
                .status(GroupBuyingAuctionStatus.DRAFT)
                .build();
        applyRequest(auction, request);
        GroupBuyingAuction saved = auctionRepository.save(auction);
        replaceTiers(saved, request);
        return mapper.toAuctionDto(saved);
    }

    @Override
    @Transactional
    public GroupBuyingAuctionDto updateAuction(String sellerEmail, UUID auctionId, GroupBuyingAuctionRequest request) {
        SellerStore store = requireStore(sellerEmail);
        GroupBuyingAuction auction = requireOwnedAuction(store, auctionId);
        if (auction.getStatus() != GroupBuyingAuctionStatus.DRAFT
                && auction.getStatus() != GroupBuyingAuctionStatus.SCHEDULED) {
            throw bad("Only draft or scheduled auctions can be edited");
        }
        if (auction.getStatus() == GroupBuyingAuctionStatus.SCHEDULED && !request.getStartsAt().isAfter(LocalDateTime.now())) {
            throw bad("A published auction can only be edited to a future start time");
        }
        Product product = requireOwnedProduct(store, request.getProductId());
        validateRequest(request, product);

        auction.setProduct(product);
        applyRequest(auction, request);
        auctionRepository.save(auction);
        replaceTiers(auction, request);
        return mapper.toAuctionDto(auction);
    }

    @Override
    @Transactional
    public GroupBuyingAuctionDto publishAuction(String sellerEmail, UUID auctionId) {
        SellerStore store = requireStore(sellerEmail);
        GroupBuyingAuction auction = auctionRepository.findByIdForUpdate(auctionId)
                .filter(a -> a.getSellerStore().getId().equals(store.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyingAuction", "id", auctionId));

        if (auction.getStatus() != GroupBuyingAuctionStatus.DRAFT) {
            throw bad("Only draft auctions can be published");
        }
        LocalDateTime now = LocalDateTime.now();
        if (!auction.getEndsAt().isAfter(now)) {
            throw bad("The auction end time must still be in the future");
        }
        Integer stock = productRepository.findStockQuantityById(auction.getProduct().getId());
        if (stock == null || stock < auction.getAvailableQuantity()) {
            throw bad("The product has only " + (stock == null ? 0 : stock) + " unit(s) in stock but this auction needs "
                    + auction.getAvailableQuantity());
        }

        auction.setStatus(auction.getStartsAt().isAfter(now)
                ? GroupBuyingAuctionStatus.SCHEDULED : GroupBuyingAuctionStatus.OPEN);
        auctionRepository.save(auction);

        notify(store.getUser(), "Group buying auction published",
                "Your auction for '" + shortText(auction.getProduct().getName(), 80) + "' is "
                        + (auction.getStatus() == GroupBuyingAuctionStatus.OPEN ? "now open for bids" : "scheduled")
                        + " until " + auction.getEndsAt() + ".", SELLER_LINK);
        return mapper.toAuctionDto(auction);
    }

    @Override
    @Transactional
    public GroupBuyingAuctionDto cancelAuction(String sellerEmail, UUID auctionId, String reason) {
        SellerStore store = requireStore(sellerEmail);
        GroupBuyingAuction auction = auctionRepository.findByIdForUpdate(auctionId)
                .filter(a -> a.getSellerStore().getId().equals(store.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyingAuction", "id", auctionId));

        if (auction.getStatus().isTerminal()) {
            throw bad("This auction has already ended");
        }
        if (auction.getStatus() == GroupBuyingAuctionStatus.OPEN) {
            // An open auction always resolves through the one-shot finalization path so a
            // half-finished auction can never be left behind.
            return finalizationService.finalizeAuction(auctionId, sellerEmail, true);
        }
        auction.setStatus(GroupBuyingAuctionStatus.CANCELLED);
        auction.setCloseCode(GroupBuyingAuctionCloseCode.CANCELLED_BY_SELLER);
        auction.setCloseNote(shortText(reasonOrDefault(reason, "Cancelled by the seller"), 500));
        auctionRepository.save(auction);
        return mapper.toAuctionDto(auction);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuctionParticipationDto> getSellerAuctionParticipations(
            String sellerEmail, UUID auctionId) {
        SellerStore store = requireStore(sellerEmail);
        GroupBuyingAuction auction = requireOwnedAuction(store, auctionId);
        return participationRepository.findByAuctionIdOrderByCreatedAtAsc(auctionId).stream()
                .map(mapper::toParticipationDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public AuctionResultDto getResult(UUID auctionId) {
        return resultRepository.findByAuctionId(auctionId)
                // Derived from the settled bids and their orders rather than read off the result
                // row, so a result row written before the aggregate columns existed cannot report
                // zero units sold against delivered orders.
                .map(result -> mapper.toResultDto(result,
                        participationRepository.sumWonQuantity(auctionId),
                        participationRepository.sumOutbidQuantity(auctionId),
                        participationRepository.sumWonOrderTotals(auctionId)))
                .orElse(null);
    }

    // ----- Marketplace -------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<GroupBuyingAuctionDto> getMarketplaceAuctions() {
        return auctionRepository.findLiveAuctionsForMarketplace(LocalDateTime.now()).stream()
                .map(mapper::toAuctionDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public GroupBuyingAuctionDto getPublicAuction(UUID auctionId) {
        return mapper.toAuctionDto(auctionRepository.findDetailedById(auctionId)
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyingAuction", "id", auctionId)));
    }

    // ----- Admin -------------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<GroupBuyingAuctionDto> getAllAuctions(String status) {
        List<GroupBuyingAuction> auctions = status == null || status.isBlank()
                ? auctionRepository.findAll()
                : auctionRepository.findByStatusOrderByCreatedAtDesc(parseStatus(status));
        return auctions.stream().map(mapper::toAuctionDto).toList();
    }

    @Override
    @Transactional
    public GroupBuyingAuctionDto forceCancelAuction(String adminEmail, UUID auctionId, String reason) {
        GroupBuyingAuction auction = auctionRepository.findByIdForUpdate(auctionId)
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyingAuction", "id", auctionId));
        if (auction.getStatus().isTerminal()) {
            throw bad("This auction has already ended");
        }
        String note = reasonOrDefault(reason, "Cancelled by an administrator");
        if (auction.getStatus() == GroupBuyingAuctionStatus.OPEN) {
            GroupBuyingAuctionDto finalized = finalizationService.finalizeAuction(auctionId, adminEmail, true);
            notify(auction.getSellerStore().getUser(), "Group buying auction ended",
                    "An administrator ended your auction for '" + shortText(auction.getProduct().getName(), 80)
                            + "'. Reason: " + note, SELLER_LINK);
            return finalized;
        }
        auction.setStatus(GroupBuyingAuctionStatus.CANCELLED);
        auction.setCloseCode(GroupBuyingAuctionCloseCode.CANCELLED_BY_SELLER);
        auction.setCloseNote(shortText(note, 500));
        auctionRepository.save(auction);
        notify(auction.getSellerStore().getUser(), "Group buying auction cancelled",
                "An administrator cancelled your auction for '" + shortText(auction.getProduct().getName(), 80)
                        + "'. Reason: " + note, SELLER_LINK);
        return mapper.toAuctionDto(auction);
    }

    // ----- Scheduler ----------------------------------------------------------------------------

    @Override
    @Transactional
    public void openDueAuction(UUID auctionId) {
        GroupBuyingAuction auction = auctionRepository.findByIdForUpdate(auctionId)
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyingAuction", "id", auctionId));
        if (auction.getStatus() != GroupBuyingAuctionStatus.SCHEDULED
                || auction.getStartsAt().isAfter(LocalDateTime.now())) {
            return;
        }
        if (!auction.getEndsAt().isAfter(LocalDateTime.now())) {
            // Its whole window elapsed while the scheduler was down: resolve it immediately.
            finalizationService.finalizeAuction(auctionId, null, false);
            return;
        }
        auction.setStatus(GroupBuyingAuctionStatus.OPEN);
        auctionRepository.save(auction);
    }

    @Override
    public void finalizeExpiredAuction(UUID auctionId) {
        finalizationService.finalizeAuction(auctionId, null, false);
    }

    // ----- Validation --------------------------------------------------------------------------

    private void validateRequest(GroupBuyingAuctionRequest request, Product product) {
        if (!product.isActive()) {
            throw bad("Only active products can be used for group buying auctions");
        }
        if (!request.getEndsAt().isAfter(request.getStartsAt())) {
            throw bad("The auction end time must be after its start time");
        }
        if (!request.getEndsAt().isAfter(LocalDateTime.now())) {
            throw bad("The auction end time must be in the future");
        }
        if (request.getMinimumCollectiveQuantity() > request.getAvailableQuantity()) {
            throw bad("The minimum collective quantity cannot exceed the available quantity");
        }
        if (request.getMaxQuantityPerCustomer() < request.getMinQuantityPerCustomer()) {
            throw bad("Maximum quantity per customer must be greater than or equal to the minimum");
        }
        if (request.getMaxQuantityPerCustomer() > request.getAvailableQuantity()) {
            throw bad("Maximum quantity per customer cannot exceed the available quantity");
        }
        if (request.getAvailableQuantity() > product.getStockQuantity()) {
            throw bad("Only " + product.getStockQuantity() + " unit(s) of this product are in stock");
        }
        try {
            // Delegates the whole pricing-rule check to the one component that owns pricing.
            pricingService.validateAndProject(request.getPricingRule(), request.getStartingPrice(),
                    request.getDiscountPercent(), toTierDtos(request.getTiers()),
                    request.getMinimumCollectiveQuantity(), request.getMinimumSellerUnitPrice());
        } catch (IllegalArgumentException ex) {
            throw bad(ex.getMessage());
        }
    }

    /** Maps the seller's submitted ladder into the read shape the pricing engine works with. */
    private static List<AuctionTierDto> toTierDtos(List<GroupBuyingAuctionTierRequest> tiers) {
        if (tiers == null) {
            return List.of();
        }
        return tiers.stream()
                .map(t -> AuctionTierDto.builder()
                        .minQuantity(t.getMinQuantity())
                        .unitPrice(t.getUnitPrice())
                        .build())
                .toList();
    }

    private void applyRequest(GroupBuyingAuction auction, GroupBuyingAuctionRequest request) {
        auction.setDescription(request.getDescription());
        auction.setStartingPrice(request.getStartingPrice());
        auction.setMinimumSellerUnitPrice(request.getMinimumSellerUnitPrice());
        auction.setAvailableQuantity(request.getAvailableQuantity());
        auction.setMinimumCollectiveQuantity(request.getMinimumCollectiveQuantity());
        auction.setMinQuantityPerCustomer(request.getMinQuantityPerCustomer());
        auction.setMaxQuantityPerCustomer(request.getMaxQuantityPerCustomer());
        auction.setStartsAt(request.getStartsAt());
        auction.setEndsAt(request.getEndsAt());
        auction.setPricingRule(request.getPricingRule());
        auction.setDiscountPercent(request.getPricingRule() == AuctionPricingRule.COLLECTIVE_QUANTITY_DISCOUNT
                ? request.getDiscountPercent() : null);
    }

    private void replaceTiers(GroupBuyingAuction auction, GroupBuyingAuctionRequest request) {
        tierRepository.deleteByAuctionId(auction.getId());
        if (request.getPricingRule() != AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS
                || request.getTiers() == null) {
            return;
        }
        for (var tierRequest : request.getTiers()) {
            tierRepository.save(GroupBuyingAuctionTier.builder()
                    .auction(auction)
                    .minQuantity(tierRequest.getMinQuantity())
                    .unitPrice(tierRequest.getUnitPrice())
                    .build());
        }
    }

    // ----- Helpers -----------------------------------------------------------------------------

    private SellerStore requireStore(String sellerEmail) {
        User user = userRepository.findByEmail(sellerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", sellerEmail));
        return sellerStoreRepository.findByUserId(user.getId())
                .orElseThrow(() -> bad("Create your seller store before running group buying auctions"));
    }

    private Product requireOwnedProduct(SellerStore store, UUID productId) {
        return productRepository.findById(productId)
                .filter(p -> p.getSellerStore() != null && p.getSellerStore().getId().equals(store.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", productId));
    }

    private GroupBuyingAuction requireOwnedAuction(SellerStore store, UUID auctionId) {
        return auctionRepository.findById(auctionId)
                .filter(a -> a.getSellerStore().getId().equals(store.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyingAuction", "id", auctionId));
    }

    private GroupBuyingAuctionStatus parseStatus(String status) {
        try {
            return GroupBuyingAuctionStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw bad("Unknown auction status: " + status);
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
                .type("GROUP_BUYING_AUCTION")
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
