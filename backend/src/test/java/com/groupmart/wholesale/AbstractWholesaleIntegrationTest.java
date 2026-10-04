package com.groupmart.wholesale;

import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.WholesaleOfferService;
import com.groupmart.service.WholesalePoolService;
import com.groupmart.service.WholesalePurchaseService;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Shared fixtures for CWP integration tests. Runs against a dedicated, disposable Postgres
 * database (see application-test.properties) with real transactions and real row locking -
 * an in-memory database would not exercise PESSIMISTIC_WRITE the same way production does.
 */
@SpringBootTest
@ActiveProfiles("test")
public abstract class AbstractWholesaleIntegrationTest {

    private static final AtomicInteger COUNTER = new AtomicInteger();

    @Autowired protected UserRepository userRepository;
    @Autowired protected SellerStoreRepository sellerStoreRepository;
    @Autowired protected ProductRepository productRepository;
    @Autowired protected CategoryRepository categoryRepository;
    @Autowired protected AddressRepository addressRepository;

    @Autowired protected WholesaleOfferRepository offerRepository;
    @Autowired protected WholesalePoolRepository poolRepository;
    @Autowired protected WholesaleReservationRepository reservationRepository;
    @Autowired protected WholesalePurchaseRepository purchaseRepository;
    @Autowired protected OrderRepository orderRepository;
    @Autowired protected OrderItemRepository orderItemRepository;
    @Autowired protected PaymentTransactionRepository paymentTransactionRepository;
    @Autowired protected InventoryLogRepository inventoryLogRepository;
    @Autowired protected NotificationRepository notificationRepository;

    @Autowired protected WholesaleOfferService offerService;
    @Autowired protected WholesalePoolService poolService;
    @Autowired protected WholesalePurchaseService purchaseService;

    @Autowired protected PasswordEncoder passwordEncoder;

    /** Deletes everything this test suite could have written, in FK-safe order, so runs don't interfere. */
    @AfterEach
    void cleanUpWholesaleData() {
        // wholesale_reservations references both orders and pools, so it must go first.
        paymentTransactionRepository.deleteAll();
        orderItemRepository.deleteAll();
        reservationRepository.deleteAll();
        orderRepository.deleteAll();
        purchaseRepository.deleteAll();
        poolRepository.deleteAll();
        offerRepository.deleteAll();
        inventoryLogRepository.deleteAll();
        notificationRepository.deleteAll();
        addressRepository.deleteAll();
        productRepository.deleteAll();
        sellerStoreRepository.deleteAll();
        userRepository.deleteAll();
        categoryRepository.deleteAll();
    }

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

    /** Creates and activates a wholesale offer (seller-only, no admin approval), which opens lot #1. */
    protected WholesaleOffer createActiveOffer(String sellerEmail, UUID productId,
                                                BigDecimal wholesaleUnitPrice, int minimumQuantity, int maxAvailableQuantity,
                                                int minPerCustomer, int maxPerCustomer) {
        var request = com.groupmart.dto.wholesale.WholesaleOfferRequest.builder()
                .productId(productId)
                .mode(WholesaleOfferMode.MINIMUM_QUANTITY_BASED)
                .wholesaleUnitPrice(wholesaleUnitPrice)
                .wholesaleMinimumQuantity(minimumQuantity)
                .maxAvailableQuantity(maxAvailableQuantity)
                .minQuantityPerCustomer(minPerCustomer)
                .maxQuantityPerCustomer(maxPerCustomer)
                .reservationDeadline(LocalDateTime.now().plusDays(7))
                .build();
        var created = offerService.createOffer(sellerEmail, request);
        offerService.activateOffer(sellerEmail, created.getId());
        return offerRepository.findById(created.getId()).orElseThrow();
    }
}
