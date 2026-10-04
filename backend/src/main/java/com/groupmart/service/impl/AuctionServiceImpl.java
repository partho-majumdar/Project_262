package com.groupmart.service.impl;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.auction.AuctionCancelRequest;
import com.groupmart.dto.auction.AuctionCreateRequest;
import com.groupmart.dto.auction.AuctionDto;
import com.groupmart.dto.auction.AuctionUpdateRequest;
import com.groupmart.dto.auction.SellerAuctionDto;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.AuctionClosingService;
import com.groupmart.service.AuctionService;
import com.groupmart.service.NotificationService;

/**
 * Seller lifecycle for eBay-style proxy auctions.
 * <p>
 * The lot's units leave sellable stock when the auction is created, not when it is won, so the
 * seller cannot auction the same stock twice and a live auction's stock is genuinely held. A
 * cancellation or a sale-less close puts the units back.
 */
@Service
@RequiredArgsConstructor
public class AuctionServiceImpl implements AuctionService {

    /** The whole lot is reserved on behalf of this mechanism, not of any single bidder. */
    private static final String STOCK_REASON = "AUCTION_LOT_RESERVE";
    private static final String NOTIFICATION_TYPE = "AUCTION";

    private final AuctionRepository auctionRepository;
    private final AuctionBidRepository bidRepository;
    private final UserRepository userRepository;
    private final SellerStoreRepository sellerStoreRepository;
    private final ProductRepository productRepository;
    private final ReservedStockManager stockManager;
    private final NotificationService notificationService;
    private final AuctionMapper mapper;
    private final AuctionClosingService closingService;

    @Override
    @Transactional
    public SellerAuctionDto createAuction(String sellerEmail, AuctionCreateRequest request) {
        User seller = requireUser(sellerEmail);
        SellerStore store = requireStore(seller);

        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", request.getProductId()));
        requireOwnsProduct(store, product);
        if (!product.isActive()) {
            throw bad("'" + product.getName() + "' is not an active product, so it cannot be auctioned");
        }

        requirePositive(request.getStartingPrice(), "Starting price");
        requirePositive(request.getMinimumBidIncrement(), "Minimum bid increment");
        if (request.getReservePrice() != null) {
            requirePositive(request.getReservePrice(), "Reserve price");
            if (request.getReservePrice().compareTo(request.getStartingPrice()) < 0) {
                throw bad("A reserve price cannot be lower than the starting price of "
                        + request.getStartingPrice());
            }
        }
        if (request.getQuantity() == null || request.getQuantity() < 1) {
            throw bad("An auction must offer at least 1 unit");
        }
        if (!request.getEndsAt().isAfter(request.getStartsAt())) {
            throw bad("The auction must end after it starts");
        }
        if (!request.getEndsAt().isAfter(LocalDateTime.now())) {
            throw bad("The auction end time must be in the future");
        }

        // Takes the lot out of sellable stock so the same units can never back two live auctions.
        stockManager.reserve(product, store, request.getQuantity(), STOCK_REASON, "AUCTION_NEW:" + product.getId());

        Auction auction = auctionRepository.save(Auction.builder()
                .product(product)
                .sellerStore(store)
                .description(shortText(request.getDescription(), 2000))
                .status(AuctionStatus.DRAFT)
                .startingPrice(request.getStartingPrice())
                .minimumBidIncrement(request.getMinimumBidIncrement())
                .currentPrice(request.getStartingPrice())
                .reservePrice(request.getReservePrice())
                .quantity(request.getQuantity())
                .startsAt(request.getStartsAt())
                .endsAt(request.getEndsAt())
                .inventoryReserved(true)
                .build());

        return mapper.toSellerDto(auction);
    }

    @Override
    @Transactional
    public SellerAuctionDto updateAuction(String sellerEmail, UUID auctionId, AuctionUpdateRequest request) {
        Auction auction = requireOwnedAuction(sellerEmail, auctionId);
        if (auction.getStatus().isTerminal()) {
            throw bad("A closed auction can no longer be edited");
        }

        // Description is the only field safe to touch once the auction is visible: changing the
        // price, the increment, the lot size or the schedule under live bidders would break the
        // terms the auction already promised them.
        if (request.getDescription() != null) {
            auction.setDescription(shortText(request.getDescription(), 2000));
        }

        boolean published = auction.getStatus() != AuctionStatus.DRAFT;
        boolean changesTerms = request.getStartingPrice() != null
                || request.getMinimumBidIncrement() != null
                || request.getQuantity() != null
                || request.getStartsAt() != null
                || request.getEndsAt() != null;

        if (published && changesTerms) {
            throw bad("Once an auction is published its price, increment, quantity and schedule are "
                    + "fixed; only the description can still change");
        }

        if (request.getStartingPrice() != null) {
            requirePositive(request.getStartingPrice(), "Starting price");
            auction.setStartingPrice(request.getStartingPrice());
        }
        if (request.getMinimumBidIncrement() != null) {
            requirePositive(request.getMinimumBidIncrement(), "Minimum bid increment");
            auction.setMinimumBidIncrement(request.getMinimumBidIncrement());
        }
        if (request.getQuantity() != null) {
            throw bad("The lot size cannot be changed after the auction is created");
        }
        if (request.getStartsAt() != null || request.getEndsAt() != null) {
            LocalDateTime starts = request.getStartsAt() != null ? request.getStartsAt() : auction.getStartsAt();
            LocalDateTime ends = request.getEndsAt() != null ? request.getEndsAt() : auction.getEndsAt();
            if (!ends.isAfter(starts)) {
                throw bad("The auction must end after it starts");
            }
            auction.setStartsAt(starts);
            auction.setEndsAt(ends);
        }
        if (request.getReservePrice() != null) {
            // The reserve is private, but moving it after somebody has bid still changes the terms
            // they accepted, so it is frozen as soon as the first bid lands.
            if (auction.getBidCount() > 0) {
                throw bad("The reserve price cannot be changed once the first bid has been placed");
            }
            requirePositive(request.getReservePrice(), "Reserve price");
            if (request.getReservePrice().compareTo(auction.getStartingPrice()) < 0) {
                throw bad("A reserve price cannot be lower than the starting price of "
                        + auction.getStartingPrice());
            }
            auction.setReservePrice(request.getReservePrice());
        }

        if (auction.getStatus() == AuctionStatus.DRAFT && auction.getCurrentPrice() == null) {
            auction.setCurrentPrice(auction.getStartingPrice());
        }

        return mapper.toSellerDto(auctionRepository.save(auction));
    }

    @Override
    @Transactional
    public SellerAuctionDto publishAuction(String sellerEmail, UUID auctionId) {
        Auction auction = requireOwnedAuction(sellerEmail, auctionId);
        if (auction.getStatus() != AuctionStatus.DRAFT) {
            throw bad("Only a draft auction can be published");
        }
        if (!auction.getEndsAt().isAfter(LocalDateTime.now())) {
            throw bad("This auction's end time is already in the past, so it cannot be published");
        }
        if (!auction.isInventoryReserved()) {
            // Defensive: the lot is normally taken at creation. Reserve it now if that ever failed.
            stockManager.reserve(auction.getProduct(), auction.getSellerStore(), auction.getQuantity(),
                    STOCK_REASON, "AUCTION_PUBLISH:" + auction.getId());
            auction.setInventoryReserved(true);
        }

        // A start time already in the past means the auction is live the moment it is published.
        auction.setStatus(LocalDateTime.now().isBefore(auction.getStartsAt())
                ? AuctionStatus.SCHEDULED
                : AuctionStatus.LIVE);
        auctionRepository.save(auction);

        notify(auction.getSellerStore().getUser(), "Auction published",
                "'" + shortText(auction.getProduct().getName(), 60) + "' is now "
                        + (auction.getStatus() == AuctionStatus.LIVE ? "live for bids." : "scheduled."),
                "/seller/dashboard?tab=auctions");
        notifyWatchers(auction, "Auction coming up",
                "'" + shortText(auction.getProduct().getName(), 60) + "' from "
                        + auction.getSellerStore().getStoreName() + " opens at " + auction.getStartsAt() + ".");

        return mapper.toSellerDto(auction);
    }

    @Override
    @Transactional
    public SellerAuctionDto cancelAuction(String sellerEmail, UUID auctionId, AuctionCancelRequest request) {
        Auction auction = requireOwnedAuction(sellerEmail, auctionId);
        if (auction.getStatus().isTerminal()) {
            throw bad("This auction has already finished");
        }
        String reason = request != null && request.getReason() != null && !request.getReason().isBlank()
                ? shortText(request.getReason(), 500)
                : "Cancelled by the seller";

        auction.setStatus(AuctionStatus.CANCELLED);
        auction.setCloseCode(AuctionCloseCode.CANCELLED_BY_SELLER);
        auction.setCloseNote(reason);
        auction.setEndedAt(LocalDateTime.now());
        auction.setClosedByUserId(auction.getSellerStore().getUser().getId());

        releaseLot(auction, "AUCTION_CANCELLED");
        // Nobody bought anything, so every live bid becomes a loss rather than a refund.
        for (AuctionBid bid : bidRepository.findByAuctionIdOrderByPlacedAtAsc(auctionId)) {
            if (bid.isEligible()) {
                bid.setStatus(AuctionBidStatus.LOST);
                bidRepository.save(bid);
            }
        }
        auctionRepository.save(auction);

        notifyWatchers(auction, "Auction cancelled",
                "'" + shortText(auction.getProduct().getName(), 60) + "' was withdrawn by the seller: " + reason);
        notify(auction.getSellerStore().getUser(), "Auction cancelled",
                "You cancelled '" + shortText(auction.getProduct().getName(), 60) + "'. The stock is back on sale.",
                "/seller/dashboard?tab=auctions");

        return mapper.toSellerDto(auction);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SellerAuctionDto> getSellerAuctions(String sellerEmail) {
        SellerStore store = requireStore(requireUser(sellerEmail));
        return auctionRepository.findBySellerStoreIdOrderByCreatedAtDesc(store.getId()).stream()
                .map(mapper::toSellerDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public SellerAuctionDto getSellerAuction(String sellerEmail, UUID auctionId) {
        return mapper.toSellerDto(requireOwnedAuction(sellerEmail, auctionId));
    }

    @Override
    @Transactional(readOnly = true)
    public SellerAuctionDto getAuctionAsAdmin(UUID auctionId) {
        return mapper.toSellerDto(requireAuction(auctionId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<SellerAuctionDto> getAllAuctions(AuctionStatus status) {
        List<Auction> auctions = status == null
                ? auctionRepository.findAll()
                : auctionRepository.findByStatusOrderByEndsAtAsc(status);
        return auctions.stream().map(mapper::toSellerDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuctionDto> getMarketplaceAuctions() {
        return auctionRepository.findMarketplaceAuctions().stream()
                .map(mapper::toPublicDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public AuctionDto getPublicAuction(UUID auctionId) {
        Auction auction = requireAuction(auctionId);
        if (auction.getStatus() == AuctionStatus.DRAFT) {
            // A draft is the seller's private workspace, not marketplace content.
            throw new ResourceNotFoundException("Auction", "id", auctionId);
        }
        return mapper.toPublicDto(auction);
    }

    @Override
    @Transactional
    public int openDueAuctions() {
        int opened = 0;
        for (Auction candidate : auctionRepository.findDueToOpen(LocalDateTime.now())) {
            // Re-check under the row lock: the seller may have cancelled or already closed it.
            Auction locked = auctionRepository.findByIdForUpdate(candidate.getId()).orElse(null);
            if (locked == null || locked.getStatus() != AuctionStatus.SCHEDULED) {
                continue;
            }
            if (!locked.getEndsAt().isAfter(LocalDateTime.now())) {
                // A window that is already shut by the time we noticed: it can never take a bid.
                locked.setStatus(AuctionStatus.CANCELLED);
                locked.setCloseCode(AuctionCloseCode.DEADLINE_REACHED);
                locked.setCloseNote("The end time had already passed when this auction was published");
                locked.setEndedAt(LocalDateTime.now());
                releaseLot(locked, "AUCTION_CANCELLED");
                auctionRepository.save(locked);
                continue;
            }
            locked.setStatus(AuctionStatus.LIVE);
            auctionRepository.save(locked);
            opened++;
            notifyWatchers(locked, "Auction is live",
                    "'" + shortText(locked.getProduct().getName(), 60) + "' is now open for bids.");
        }
        return opened;
    }

    @Override
    public int closeExpiredAuction(UUID auctionId) {
        closingService.close(auctionId, null, false);
        return 1;
    }

    // ----- Helpers ----------------------------------------------------------------------------

    /** Locks the lot's inventory back into sellable stock, at most once per auction. */
    private void releaseLot(Auction auction, String reason) {
        if (!auction.isInventoryReserved()) {
            return;
        }
        stockManager.release(auction.getProduct(), auction.getSellerStore(), auction.getQuantity(),
                reason, "AUCTION:" + auction.getId());
        auction.setInventoryReserved(false);
    }

    private Auction requireAuction(UUID auctionId) {
        return auctionRepository.findById(auctionId)
                .orElseThrow(() -> new ResourceNotFoundException("Auction", "id", auctionId));
    }

    /** Ownership is enforced here, in the service, not by the caller. */
    private Auction requireOwnedAuction(String sellerEmail, UUID auctionId) {
        Auction auction = requireAuction(auctionId);
        User seller = requireUser(sellerEmail);
        if (seller.getRole() == Role.ROLE_ADMIN) {
            return auction;
        }
        SellerStore store = requireStore(seller);
        if (auction.getSellerStore() == null || !auction.getSellerStore().getId().equals(store.getId())) {
            throw new ApiException("You can only manage auctions for your own store", HttpStatus.FORBIDDEN);
        }
        return auction;
    }

    private void requireOwnsProduct(SellerStore store, Product product) {
        if (product.getSellerStore() == null || !product.getSellerStore().getId().equals(store.getId())) {
            throw new ApiException("You can only auction products from your own store", HttpStatus.FORBIDDEN);
        }
    }

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    private SellerStore requireStore(User user) {
        return sellerStoreRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ApiException(
                        "This account has no seller store, so it cannot run auctions", HttpStatus.FORBIDDEN));
    }

    private static void requirePositive(BigDecimal value, String label) {
        if (value == null || value.signum() <= 0) {
            throw bad(label + " must be greater than zero");
        }
    }

    /** Tells everybody who has a bid on this auction about a status change. */
    private void notifyWatchers(Auction auction, String title, String message) {
        bidRepository.findByAuctionIdOrderByPlacedAtAsc(auction.getId()).stream()
                .map(AuctionBid::getBidder)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .forEach(bidder -> notify(bidder, title, message, "/auctions/" + auction.getId()));
    }

    private void notify(User recipient, String title, String message, String link) {
        if (recipient == null) {
            return;
        }
        notificationService.sendNotification(com.groupmart.dto.notification.SendNotificationRequest.builder()
                .userId(recipient.getId())
                .title(shortText(title, 150))
                .message(shortText(message, 1000))
                .type(NOTIFICATION_TYPE)
                .link(link)
                .build());
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
