package com.groupmart.groupreverse;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import com.groupmart.dto.groupr.CreateGroupReverseDemandRequest;
import com.groupmart.dto.groupr.JoinGroupReverseDemandRequest;
import com.groupmart.dto.groupr.SubmitGroupReverseOfferRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.scheduler.GroupReverseScheduler;
import com.groupmart.service.*;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Shared fixtures for the group reverse buying suite.
 * <p>
 * Runs against real PostgreSQL, because the guarantees under test - a {@code SELECT ... FOR UPDATE}
 * row lock serialising simultaneous joins, a unique constraint on (demand, customer), an atomic
 * conditional stock decrement - are precisely what an in-memory database would not reproduce.
 */
@SpringBootTest
@ActiveProfiles("test")
public abstract class AbstractGroupReverseTest {

    private static final AtomicInteger COUNTER = new AtomicInteger();

    @Autowired protected GroupReverseDemandRepository demandRepository;
    @Autowired protected GroupReverseMemberRepository memberRepository;
    @Autowired protected GroupReverseOfferRepository groupOfferRepository;
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

    @Autowired protected GroupReverseDemandService demandService;
    @Autowired protected GroupReverseParticipationService participationService;
    @Autowired protected GroupReverseOfferService offerService;
    @Autowired protected GroupReverseScheduler scheduler;

    @Autowired protected PasswordEncoder passwordEncoder;

    @jakarta.persistence.PersistenceContext
    jakarta.persistence.EntityManager em;

    @Autowired
    org.springframework.transaction.PlatformTransactionManager txManager;

    @AfterEach
    void cleanUp() {
        // FK-safe teardown, in strict dependency order, so a run never leaves rows behind:
        //   members -> orders  (members hold the FK, so they must go first)
        //   orders  -> demands
        //   demands <-> offers is circular (demands.selected_offer_id, offers.demand_id), so the
        //   cycle is broken by clearing selected_offer_id before the offers go.
        paymentTransactionRepository.deleteAll();
        orderItemRepository.deleteAll();
        memberRepository.deleteAll();
        orderRepository.deleteAll();
        breakDemandOfferCycle();
        groupOfferRepository.deleteAll();
        demandRepository.deleteAll();
        inventoryLogRepository.deleteAll();
        notificationRepository.deleteAll();
        addressRepository.deleteAll();
        productRepository.deleteAll();
        sellerStoreRepository.deleteAll();
        userRepository.deleteAll();
        categoryRepository.deleteAll();
    }

    /** One statement that nulls every selected offer, breaking the demand/offer FK cycle. */
    private void breakDemandOfferCycle() {
        new org.springframework.transaction.support.TransactionTemplate(txManager).executeWithoutResult(
                status -> em.createQuery("update GroupReverseDemand d set d.selectedOffer = null")
                        .executeUpdate());
        em.clear();
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

    /** A verified seller store, which is what the offer service requires of a bidding store. */
    protected SellerStore createSellerStore(User owner) {
        int n = COUNTER.incrementAndGet();
        return sellerStoreRepository.save(SellerStore.builder()
                .user(owner)
                .storeName("GR Store " + n)
                .storeSlug("gr-store-" + n)
                .verified(true)
                .build());
    }

    protected Category createCategory() {
        int n = COUNTER.incrementAndGet();
        return categoryRepository.save(Category.builder()
                .name("GR Category " + n)
                .slug("gr-category-" + n)
                .active(true)
                .build());
    }

    protected Product createProduct(SellerStore store, java.math.BigDecimal price, int stock) {
        int n = COUNTER.incrementAndGet();
        return productRepository.save(Product.builder()
                .name("GR Product " + n)
                .sku("GR-SKU-" + n)
                .slug("gr-product-" + n)
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

    // ----- Flow helpers ------------------------------------------------------------------------

    /** Creates and publishes a demand, so it is OPEN with a join deadline {@code joinHours} out. */
    protected GroupReverseDemand createOpenDemand(User leader, Product product, int requiredQuantity,
                                                 java.math.BigDecimal targetPrice,
                                                 java.math.BigDecimal maxPrice, double joinHours) {
        GroupReverseDemand demand = createDraftDemand(leader, product, requiredQuantity, targetPrice,
                maxPrice, joinHours);
        demandService.publishDemand(leader.getEmail(), demand.getId());
        return reloadDemand(demand.getId());
    }

    protected GroupReverseDemand createDraftDemand(User leader, Product product, int requiredQuantity,
                                                  java.math.BigDecimal targetPrice,
                                                  java.math.BigDecimal maxPrice, double joinHours) {
        LocalDateTime now = LocalDateTime.now();
        var created = demandService.createDemand(leader.getEmail(), CreateGroupReverseDemandRequest.builder()
                .productId(product.getId())
                .description("A group wanting this product at a fair price")
                .requiredQuantity(requiredQuantity)
                .targetPrice(targetPrice)
                .maxPrice(maxPrice)
                .minQuantityPerMember(1)
                .maxQuantityPerMember(requiredQuantity)
                .joinDeadline(now.plusHours((long) joinHours))
                .offerDeadline(now.plusHours((long) joinHours + 48))
                .deliveryCity("Dhaka")
                .build());
        return demandRepository.findById(created.getId()).orElseThrow();
    }

    protected GroupReverseMember join(GroupReverseDemand demand, User customer, int quantity) {
        return join(demand, customer, quantity, "CREDIT_CARD");
    }

    protected GroupReverseMember join(GroupReverseDemand demand, User customer, int quantity,
                                      String paymentMethod) {
        Address address = createAddress(customer);
        participationService.joinDemand(customer.getEmail(), demand.getId(),
                JoinGroupReverseDemandRequest.builder()
                        .quantity(quantity)
                        .addressId(address.getId())
                        .paymentMethod(paymentMethod)
                        .build());
        return memberRepository.findByDemandIdAndCustomerId(demand.getId(), customer.getId()).orElseThrow();
    }

    protected GroupReverseOffer submitOffer(GroupReverseDemand demand, User seller,
                                            java.math.BigDecimal unitPrice, int quantity) {
        // An offer may never outlive the demand's own offer deadline, so the fixture mirrors it.
        LocalDateTime expiry = demand.getOfferDeadline().minusHours(1);
        var dto = offerService.submitOffer(seller.getEmail(), demand.getId(),
                SubmitGroupReverseOfferRequest.builder()
                        .unitPrice(unitPrice)
                        .offeredQuantity(quantity)
                        .deliveryFee(new java.math.BigDecimal("0"))
                        .estimatedDeliveryDays(3)
                        .warrantyMonths(12)
                        .offerExpiry(expiry)
                        .message("We can fulfil the whole group.")
                        .build());
        return groupOfferRepository.findById(dto.getId()).orElseThrow();
    }

    protected GroupReverseDemand reloadDemand(UUID id) {
        return demandRepository.findById(id).orElseThrow();
    }

    protected int stockOf(Product product) {
        return productRepository.findById(product.getId()).orElseThrow().getStockQuantity();
    }

    /** Asserts the group's committed quantity never exceeds what it asked for. */
    protected void assertNotOversubscribed(GroupReverseDemand demand) {
        long committed = memberRepository.sumActiveQuantity(demand.getId());
        assertThat(committed)
                .as("committed quantity must never exceed the group target")
                .isLessThanOrEqualTo(demand.getRequiredQuantity());
        assertThat(reloadDemand(demand.getId()).getCommittedQuantity())
                .isEqualTo((int) committed);
    }
}
