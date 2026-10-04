package com.groupmart.review;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.groupmart.common.exception.ApiException;
import com.groupmart.dto.review.CreateReviewRequest;
import com.groupmart.dto.review.ReviewDto;
import com.groupmart.dto.review.ReviewEligibilityDto;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.ReviewService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A review must be earned by delivery: only a customer whose order for the product reached
 * DELIVERED may write one, and only once.
 * <p>
 * Uses the same disposable PostgreSQL test database as the rest of the suite, because the rule is
 * enforced through a real JPA query over the order/order-item graph.
 */
@SpringBootTest
@ActiveProfiles("test")
class ReviewDeliveryEligibilityTest {

    @Autowired ReviewService reviewService;
    @Autowired ReviewRepository reviewRepository;
    @Autowired ProductRepository productRepository;
    @Autowired UserRepository userRepository;
    @Autowired SellerStoreRepository sellerStoreRepository;
    @Autowired CategoryRepository categoryRepository;
    @Autowired AddressRepository addressRepository;
    @Autowired OrderRepository orderRepository;
    @Autowired OrderItemRepository orderItemRepository;
    @Autowired PaymentTransactionRepository paymentTransactionRepository;
    @Autowired InventoryLogRepository inventoryLogRepository;
    @Autowired NotificationRepository notificationRepository;
    @Autowired PasswordEncoder passwordEncoder;

    @Test
    void cannotReviewWithoutBuyingTheProduct() {
        Seller seller = seller();
        Product product = product(seller.store);
        User stranger = customer();

        assertThat(reviewService.getEligibility(stranger.getEmail(), product.getId()).isEligible()).isFalse();
        assertThat(reviewService.getEligibility(stranger.getEmail(), product.getId()).getReason())
                .contains("delivered");

        assertThatThrownBy(() -> reviewService.createReview(stranger.getEmail(), product.getId(), review(4)))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).getStatus())
                        .isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    void cannotReviewWhileTheOrderIsStillInTransit() {
        Seller seller = seller();
        Product product = product(seller.store);
        User buyer = customer();
        placeOrder(buyer, product, OrderStatus.PROCESSING);
        placeOrder(buyer, product, OrderStatus.SHIPPED);

        assertThat(reviewService.getEligibility(buyer.getEmail(), product.getId()).isEligible()).isFalse();

        assertThatThrownBy(() -> reviewService.createReview(buyer.getEmail(), product.getId(), review(5)))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void canReviewOnceTheOrderIsDelivered() {
        Seller seller = seller();
        Product product = product(seller.store);
        User buyer = customer();
        Order delivered = placeOrder(buyer, product, OrderStatus.SHIPPED);
        delivered.setStatus(OrderStatus.DELIVERED);
        delivered.setDeliveredAt(LocalDateTime.now());
        orderRepository.save(delivered);

        ReviewEligibilityDto eligibility = reviewService.getEligibility(buyer.getEmail(), product.getId());
        assertThat(eligibility.isEligible()).isTrue();
        assertThat(eligibility.getOrderNumber()).isEqualTo(delivered.getOrderNumber());

        ReviewDto created = reviewService.createReview(buyer.getEmail(), product.getId(), review(5));
        assertThat(created.isVerifiedPurchase()).isTrue();
        assertThat(reviewRepository.countByProductId(product.getId())).isEqualTo(1);
    }

    @Test
    void deliveredPurchaseGrantsOnlyOneReview() {
        Seller seller = seller();
        Product product = product(seller.store);
        User buyer = customer();
        placeOrder(buyer, product, OrderStatus.DELIVERED);

        reviewService.createReview(buyer.getEmail(), product.getId(), review(4));

        assertThat(reviewService.getEligibility(buyer.getEmail(), product.getId()).isEligible()).isFalse();
        assertThatThrownBy(() -> reviewService.createReview(buyer.getEmail(), product.getId(), review(1)))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).getStatus())
                        .isEqualTo(HttpStatus.CONFLICT));
        assertThat(reviewRepository.countByProductId(product.getId())).isEqualTo(1);
    }

    @Test
    void deliveringSomeoneElsesProductDoesNotGrantEligibility() {
        Seller seller = seller();
        Product product = product(seller.store);
        User buyer = customer();
        User other = customer();
        placeOrder(buyer, product, OrderStatus.DELIVERED);

        assertThat(reviewService.getEligibility(other.getEmail(), product.getId()).isEligible()).isFalse();
    }

    /** The orders page marks a whole page of lines from one batch response. */
    @Test
    void batchEligibilityMatchesTheSingleProductAnswer() {
        Seller seller = seller();
        Product deliveredProduct = product(seller.store);
        Product inTransitProduct = product(seller.store);
        Product unboughtProduct = product(seller.store);
        User buyer = customer();
        placeOrder(buyer, deliveredProduct, OrderStatus.DELIVERED);
        placeOrder(buyer, inTransitProduct, OrderStatus.SHIPPED);
        reviewService.createReview(buyer.getEmail(), deliveredProduct.getId(), review(5));
        placeOrder(buyer, deliveredProduct, OrderStatus.DELIVERED);

        List<ReviewEligibilityDto> results = reviewService.getEligibilityForProducts(
                buyer.getEmail(),
                List.of(deliveredProduct.getId(), inTransitProduct.getId(), unboughtProduct.getId()));

        assertThat(results).hasSize(3);
        // Already reviewed, so the delivered product is no longer writable.
        assertThat(results).allMatch(r -> !r.isEligible());
        assertThat(results.get(0).getReason()).contains("already reviewed");
        assertThat(results.get(1).getReason()).contains("delivered");
        assertThat(results.get(2).getReason()).contains("delivered");
    }

    @Test
    void batchEligibilityIsEmptyForNoProducts() {
        User buyer = customer();

        assertThat(reviewService.getEligibilityForProducts(buyer.getEmail(), List.of())).isEmpty();
    }

    // ----- fixtures ------------------------------------------------------------------------------

    private static int seq = 0;
    // Products get their own counter: the category slug must stay unique even when a test
    // creates several products without creating a user in between.
    private static int productSeq = 0;

    private record Seller(User user, SellerStore store) {}

    private Seller seller() {
        User user = userRepository.save(User.builder()
                .email("rev-seller-" + (++seq) + "@test.groupmart.local")
                .password(passwordEncoder.encode("Password@123"))
                .firstName("Rev")
                .lastName("Seller")
                .role(Role.ROLE_SELLER)
                .sellerStatus(SellerStatus.APPROVED)
                .enabled(true)
                .build());
        SellerStore store = sellerStoreRepository.save(SellerStore.builder()
                .user(user)
                .storeName("Rev Store " + seq)
                .storeSlug("rev-store-" + seq)
                .verified(true)
                .build());
        return new Seller(user, store);
    }

    private User customer() {
        return userRepository.save(User.builder()
                .email("rev-cust-" + (++seq) + "@test.groupmart.local")
                .password(passwordEncoder.encode("Password@123"))
                .firstName("Rev")
                .lastName("Customer")
                .role(Role.ROLE_CUSTOMER)
                .sellerStatus(SellerStatus.NONE)
                .enabled(true)
                .build());
    }

    private Product product(SellerStore store) {
        int n = ++productSeq;
        Category category = categoryRepository.save(Category.builder()
                .name("Rev Category " + n)
                .slug("rev-category-" + n)
                .active(true)
                .build());
        return productRepository.save(Product.builder()
                .name("Rev Product " + n)
                .sku("REV-SKU-" + n)
                .slug("rev-product-" + n)
                .price(new BigDecimal("100.00"))
                .category(category)
                .sellerStore(store)
                .stockQuantity(50)
                .active(true)
                .build());
    }

    private Order placeOrder(User buyer, Product product, OrderStatus status) {
        Address address = addressRepository.save(Address.builder()
                .user(buyer)
                .fullName("Rev Customer")
                .phone("+1-555-0111")
                .streetAddress("9 Review Way")
                .city("Testville")
                .state("TS")
                .postalCode("00000")
                .country("Testland")
                .isDefault(true)
                .build());

        Order order = orderRepository.save(Order.builder()
                .orderNumber("REV-ORD-" + (++seq))
                .user(buyer)
                .status(status)
                .paymentStatus(PaymentStatus.COMPLETED)
                .paymentMethod(PaymentMethod.CREDIT_CARD)
                .subtotalAmount(new BigDecimal("100.00"))
                .taxAmount(BigDecimal.ZERO)
                .shippingAmount(BigDecimal.ZERO)
                .discountAmount(BigDecimal.ZERO)
                .totalAmount(new BigDecimal("100.00"))
                .shippingAddressLine1(address.getStreetAddress())
                .shippingCity(address.getCity())
                .shippingState(address.getState())
                .shippingPostalCode(address.getPostalCode())
                .shippingCountry(address.getCountry())
                .orderType(OrderType.STANDARD)
                .build());

        order.setItems(List.of(orderItemRepository.save(OrderItem.builder()
                .order(order)
                .product(product)
                .sellerStore(product.getSellerStore())
                .productName(product.getName())
                .productSku(product.getSku())
                .quantity(1)
                .unitPrice(product.getPrice())
                .subtotal(product.getPrice())
                .build())));

        return orderRepository.save(order);
    }

    private CreateReviewRequest review(int rating) {
        return CreateReviewRequest.builder()
                .rating(rating)
                .title("Solid product")
                .comment("Arrived as described.")
                .build();
    }

    @org.junit.jupiter.api.AfterEach
    void cleanUp() {
        reviewRepository.deleteAll();
        paymentTransactionRepository.deleteAll();
        orderItemRepository.deleteAll();
        orderRepository.deleteAll();
        inventoryLogRepository.deleteAll();
        notificationRepository.deleteAll();
        addressRepository.deleteAll();
        productRepository.deleteAll();
        sellerStoreRepository.deleteAll();
        userRepository.deleteAll();
        categoryRepository.deleteAll();
    }
}
