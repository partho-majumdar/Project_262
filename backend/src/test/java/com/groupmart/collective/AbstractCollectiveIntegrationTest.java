package com.groupmart.collective;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import com.groupmart.dto.auction.GroupBuyingAuctionRequest;
import com.groupmart.dto.auction.GroupBuyingAuctionTierRequest;
import com.groupmart.dto.reverse.ReverseGroupBuyingOfferRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.*;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

/**
 * Shared fixtures for the two collective purchasing mechanisms under test: Reverse Group Buying and
 * Group Buying Auctions.
 * <p>
 * Uses the same setup style and the same disposable PostgreSQL test database as the existing CWP
 * suite, because inventory oversubscription and auction finalization both depend on real
 * transactions and real row locking - an in-memory database would not exercise PESSIMISTIC_WRITE
 * the way production does.
 */
@SpringBootTest
@ActiveProfiles("test")
public abstract class AbstractCollectiveIntegrationTest {

    private static final AtomicInteger COUNTER = new AtomicInteger();

    @Autowired protected UserRepository userRepository;
    @Autowired protected SellerStoreRepository sellerStoreRepository;
    @Autowired protected ProductRepository productRepository;
    @Autowired protected CategoryRepository categoryRepository;
    @Autowired protected AddressRepository addressRepository;

    @Autowired protected ReverseGroupBuyingOfferRepository rgbOfferRepository;
    @Autowired protected ReverseGroupBuyingParticipationRepository rgbParticipationRepository;
    @Autowired protected ReverseGroupBuyingCampaignRepository rgbCampaignRepository;

    @Autowired protected GroupBuyingAuctionRepository auctionRepository;
    @Autowired protected GroupBuyingAuctionTierRepository auctionTierRepository;
    @Autowired protected GroupBuyingAuctionParticipationRepository auctionParticipationRepository;
    @Autowired protected GroupBuyingAuctionResultRepository auctionResultRepository;

    @Autowired protected GroupBuyCampaignRepository groupBuyCampaignRepository;
    @Autowired protected GroupBuyActivityRepository groupBuyActivityRepository;

    @Autowired protected OrderRepository orderRepository;
    @Autowired protected OrderItemRepository orderItemRepository;
    @Autowired protected PaymentTransactionRepository paymentTransactionRepository;
    @Autowired protected InventoryLogRepository inventoryLogRepository;
    @Autowired protected NotificationRepository notificationRepository;

    @Autowired protected ReverseGroupBuyingOfferService rgbOfferService;
    @Autowired protected ReverseGroupBuyingParticipationService rgbParticipationService;
    @Autowired protected ReverseGroupBuyingCampaignService rgbCampaignService;

    @Autowired protected GroupBuyingAuctionService auctionService;
    @Autowired protected AuctionParticipationService auctionParticipationService;
    @Autowired protected AuctionFinalizationService auctionFinalizationService;
    @Autowired protected AuctionPricingService auctionPricingService;

    @Autowired protected PasswordEncoder passwordEncoder;

    /** Deletes everything this suite could have written, in FK-safe order, so runs don't interfere. */
    @AfterEach
    void cleanUpCollectiveData() {
        paymentTransactionRepository.deleteAll();
        orderItemRepository.deleteAll();
        rgbParticipationRepository.deleteAll();
        auctionParticipationRepository.deleteAll();
        orderRepository.deleteAll();
        rgbCampaignRepository.deleteAll();
        auctionResultRepository.deleteAll();
        auctionTierRepository.deleteAll();
        auctionRepository.deleteAll();
        rgbOfferRepository.deleteAll();
        // Group buy campaigns hold an FK to products, so they must go before the product delete below.
        groupBuyActivityRepository.deleteAll();
        groupBuyCampaignRepository.deleteAll();
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
                .sellerStatus(SellerStatus.NONE)
                .enabled(true)
                .build());
    }

    protected SellerStore createSellerStore(User owner) {
        int n = COUNTER.incrementAndGet();
        return sellerStoreRepository.save(SellerStore.builder()
                .user(owner)
                .storeName("Test Store " + n)
                .storeSlug("test-store-" + n)
                .verified(true)
                .build());
    }

    protected Category createCategory() {
        int n = COUNTER.incrementAndGet();
        return categoryRepository.save(Category.builder()
                .name("Test Category " + n)
                .slug("test-category-" + n)
                .active(true)
                .build());
    }

    protected Product createProduct(SellerStore store, Category category, BigDecimal price, int stock) {
        int n = COUNTER.incrementAndGet();
        return productRepository.save(Product.builder()
                .name("Test Product " + n)
                .sku("SKU-" + n)
                .slug("test-product-" + n)
                .price(price)
                .category(category)
                .sellerStore(store)
                .stockQuantity(stock)
                .active(true)
                .build());
    }

    protected Address createAddress(User user) {
        return addressRepository.save(Address.builder()
                .user(user)
                .fullName(user.getFirstName() + " " + user.getLastName())
                .phone("+1-555-0100")
                .streetAddress("123 Test Street")
                .city("Testville")
                .state("TS")
                .postalCode("00000")
                .country("Testland")
                .isDefault(true)
                .build());
    }

    // ----- Reverse Group Buying helpers ----------------------------------------------------------

    /** Creates and publishes a Reverse Group Buying offer with a plain collective-quantity target. */
    protected ReverseGroupBuyingOffer createOpenRgbOffer(String sellerEmail, java.util.UUID productId,
                                                          BigDecimal unlockedUnitPrice, int targetQuantity,
                                                          int availableQuantity, int minPerCustomer,
                                                          int maxPerCustomer) {
        ReverseGroupBuyingOfferRequest request = ReverseGroupBuyingOfferRequest.builder()
                .productId(productId)
                .targetType(ReverseTargetType.TARGET_QUANTITY)
                .targetQuantity(targetQuantity)
                .unlockedUnitPrice(unlockedUnitPrice)
                .availableQuantity(availableQuantity)
                .minQuantityPerCustomer(minPerCustomer)
                .maxQuantityPerCustomer(maxPerCustomer)
                .participationDeadline(LocalDateTime.now().plusDays(7))
                .build();
        var created = rgbOfferService.createOffer(sellerEmail, request);
        rgbOfferService.activateOffer(sellerEmail, created.getId());
        return rgbOfferRepository.findById(created.getId()).orElseThrow();
    }

    // ----- Group Buying Auction helpers ----------------------------------------------------------

    /** Creates and publishes a tiered Group Buying Auction with a simple 2-rung price ladder. */
    protected GroupBuyingAuction createOpenTieredAuction(String sellerEmail, java.util.UUID productId,
                                                          BigDecimal startingPrice, int minimumCollective,
                                                          int availableQuantity, int minPerCustomer,
                                                          int maxPerCustomer, LocalDateTime endsAt) {
        List<GroupBuyingAuctionTierRequest> tiers = List.of(
                GroupBuyingAuctionTierRequest.builder().minQuantity(1).unitPrice(startingPrice.subtract(new BigDecimal("5"))).build(),
                GroupBuyingAuctionTierRequest.builder().minQuantity(5).unitPrice(startingPrice.subtract(new BigDecimal("10"))).build(),
                GroupBuyingAuctionTierRequest.builder().minQuantity(10).unitPrice(startingPrice.subtract(new BigDecimal("15"))).build());
        GroupBuyingAuctionRequest request = GroupBuyingAuctionRequest.builder()
                .productId(productId)
                .startingPrice(startingPrice)
                .minimumCollectiveQuantity(minimumCollective)
                .availableQuantity(availableQuantity)
                .minQuantityPerCustomer(minPerCustomer)
                .maxQuantityPerCustomer(maxPerCustomer)
                .startsAt(LocalDateTime.now().minusMinutes(1))
                .endsAt(endsAt)
                .pricingRule(AuctionPricingRule.COLLECTIVE_QUANTITY_TIERS)
                .tiers(tiers)
                .build();
        var created = auctionService.createAuction(sellerEmail, request);
        auctionService.publishAuction(sellerEmail, created.getId());
        return auctionRepository.findById(created.getId()).orElseThrow();
    }
}
