package com.groupmart.auction;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import com.groupmart.dto.auction.AuctionCreateRequest;
import com.groupmart.dto.auction.MyAuctionBidDto;
import com.groupmart.dto.auction.PlaceAuctionBidRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.AuctionBiddingService;
import com.groupmart.service.AuctionClosingService;
import com.groupmart.service.AuctionService;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

/**
 * Shared fixtures for the eBay-style proxy-auction suite.
 * <p>
 * Runs against the same disposable PostgreSQL database as the other integration suites, because
 * the behaviour under test - PESSIMISTIC_WRITE serialising simultaneous bids, a unique constraint
 * making a second close fail, an atomic stock decrement - is precisely what an in-memory database
 * would not reproduce.
 */
@SpringBootTest
@ActiveProfiles("test")
public abstract class AbstractAuctionIntegrationTest {

    private static final AtomicInteger COUNTER = new AtomicInteger();

    @Autowired protected AuctionRepository auctionRepository;
    @Autowired protected AuctionBidRepository bidRepository;
    @Autowired protected UserRepository userRepository;
    @Autowired protected SellerStoreRepository sellerStoreRepository;
    @Autowired protected ProductRepository productRepository;
    @Autowired protected CategoryRepository categoryRepository;
    @Autowired protected AddressRepository addressRepository;
    @Autowired protected OrderRepository orderRepository;
    @Autowired protected OrderItemRepository orderItemRepository;
    @Autowired protected PaymentTransactionRepository paymentTransactionRepository;
    @Autowired protected InventoryLogRepository inventoryLogRepository;
    @Autowired protected NotificationRepository notificationRepository;

    @Autowired protected AuctionService auctionService;
    @Autowired protected AuctionBiddingService biddingService;
    @Autowired protected AuctionClosingService closingService;

    @Autowired protected PasswordEncoder passwordEncoder;

    @AfterEach
    void cleanUpAuctionData() {
        // FK-safe order, so a run never leaves rows behind for the next one.
        paymentTransactionRepository.deleteAll();
        orderItemRepository.deleteAll();
        // The winner's order points at the auction, so it has to go first.
        orderRepository.deleteAll();
        bidRepository.deleteAll();
        auctionRepository.deleteAll();
        inventoryLogRepository.deleteAll();
        notificationRepository.deleteAll();
        addressRepository.deleteAll();
        productRepository.deleteAll();
        sellerStoreRepository.deleteAll();
        userRepository.deleteAll();
        categoryRepository.deleteAll();
    }

    // ----- Fixtures ----------------------------------------------------------------------------

    protected User createUser(String emailPrefix, Role role) {
        int n = COUNTER.incrementAndGet();
        return userRepository.save(User.builder()
                .email(emailPrefix + n + "@test.groupmart.local")
                .password(passwordEncoder.encode("Password@123"))
                .firstName("Test")
                .lastName("User" + n)
                .role(role)
                .sellerStatus(role == Role.ROLE_SELLER ? SellerStatus.APPROVED : SellerStatus.NONE)
                .enabled(true)
                .build());
    }

    protected SellerStore createSellerStore(User owner) {
        int n = COUNTER.incrementAndGet();
        return sellerStoreRepository.save(SellerStore.builder()
                .user(owner)
                .storeName("Auction Store " + n)
                .storeSlug("auction-store-" + n)
                .verified(true)
                .build());
    }

    protected Category createCategory() {
        int n = COUNTER.incrementAndGet();
        return categoryRepository.save(Category.builder()
                .name("Auction Category " + n)
                .slug("auction-category-" + n)
                .active(true)
                .build());
    }

    protected Product createProduct(SellerStore store, BigDecimal price, int stock) {
        int n = COUNTER.incrementAndGet();
        return productRepository.save(Product.builder()
                .name("Auction Product " + n)
                .sku("AUC-SKU-" + n)
                .slug("auction-product-" + n)
                .price(price)
                .category(createCategory())
                .sellerStore(store)
                .stockQuantity(stock)
                .active(true)
                .build());
    }

    protected Address createAddress(User user) {
        return addressRepository.save(Address.builder()
                .user(user)
                .fullName(user.getFirstName() + " " + user.getLastName())
                .phone("+1-555-0180")
                .streetAddress("18 Gavel Lane")
                .city("Testville")
                .state("TS")
                .postalCode("00000")
                .country("Testland")
                .isDefault(true)
                .build());
    }

    /** Creates a DRAFT auction with a 1-unit lot held out of stock. */
    protected Auction createDraftAuction(String sellerEmail, Product product, BigDecimal startingPrice,
                                         BigDecimal increment, BigDecimal reservePrice, int quantity,
                                         LocalDateTime startsAt, LocalDateTime endsAt) {
        var request = AuctionCreateRequest.builder()
                .productId(product.getId())
                .description("A genuine lot up for proxy bidding")
                .startingPrice(startingPrice)
                .minimumBidIncrement(increment)
                .reservePrice(reservePrice)
                .quantity(quantity)
                .startsAt(startsAt)
                .endsAt(endsAt)
                .build();
        var created = auctionService.createAuction(sellerEmail, request);
        return auctionRepository.findById(created.getId()).orElseThrow();
    }

    /** Creates and publishes, so the auction is LIVE now and closes in {@code minutes}. */
    protected Auction createLiveAuction(String sellerEmail, Product product, BigDecimal startingPrice,
                                        BigDecimal increment, BigDecimal reservePrice, int quantity,
                                        long minutesRemaining) {
        LocalDateTime now = LocalDateTime.now();
        Auction auction = createDraftAuction(sellerEmail, product, startingPrice, increment, reservePrice,
                quantity, now.minusMinutes(5), now.plusMinutes(minutesRemaining));
        auctionService.publishAuction(sellerEmail, auction.getId());
        return auctionRepository.findById(auction.getId()).orElseThrow();
    }

    /** Moves a live auction's deadline into the past, the way time passing would. */
    protected void expire(Auction auction) {
        Auction locked = auctionRepository.findById(auction.getId()).orElseThrow();
        locked.setEndsAt(LocalDateTime.now().minusSeconds(1));
        locked.setStartsAt(LocalDateTime.now().minusHours(2));
        auctionRepository.save(locked);
    }

    protected Auction reload(UUID auctionId) {
        return auctionRepository.findById(auctionId).orElseThrow();
    }

    protected Product reloadProduct(UUID productId) {
        return productRepository.findById(productId).orElseThrow();
    }

    protected List<AuctionBid> allBids(UUID auctionId) {
        return bidRepository.findByAuctionIdOrderByPlacedAtAsc(auctionId);
    }

    /** Places a one-unit proxy bid on a credit card, the way the bidding screen does. */
    protected MyAuctionBidDto bid(User user, Address address, Auction auction, BigDecimal maximum) {
        return biddingService.placeBid(user.getEmail(), auction.getId(),
                PlaceAuctionBidRequest.builder()
                        .maximumBid(maximum)
                        .quantity(1)
                        .addressId(address.getId())
                        .paymentMethod(PaymentMethod.CREDIT_CARD)
                        .build());
    }
}
