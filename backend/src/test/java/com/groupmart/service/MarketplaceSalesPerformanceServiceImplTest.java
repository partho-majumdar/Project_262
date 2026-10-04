package com.groupmart.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import com.groupmart.dto.analytics.sales.BreakdownGmvDto;
import com.groupmart.dto.analytics.sales.CityGmvDto;
import com.groupmart.dto.analytics.sales.FeatureGmvDto;
import com.groupmart.dto.analytics.sales.MarketplaceSalesPerformanceDto;
import com.groupmart.dto.analytics.sales.Granularity;
import com.groupmart.dto.analytics.sales.GmvPointDto;
import com.groupmart.dto.analytics.sales.OrderStatusGmvDto;
import com.groupmart.entity.Category;
import com.groupmart.entity.OrderStatus;
import com.groupmart.entity.Product;
import com.groupmart.entity.Role;
import com.groupmart.entity.SellerStatus;
import com.groupmart.entity.User;
import com.groupmart.repository.CategoryRepository;
import com.groupmart.repository.ProductRepository;
import com.groupmart.repository.UserRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Covers the marketplace GMV rollup against the real schema.
 *
 * <p>Runs against the database rather than mocks on purpose: the rollup leans on two interface
 * projections joined across product and category, and those only bind correctly when Hibernate
 * builds the query for real. A mocked repository would pass while the endpoint 500s.
 *
 * <p>Orders are inserted with explicit {@code created_at} because the column is stamped by
 * {@code @CreationTimestamp} on write, which would otherwise pin every fixture to today and make
 * the month bucketing untestable.
 */
@SpringBootTest
@ActiveProfiles("test")
class MarketplaceSalesPerformanceServiceImplTest {

    private static final int WINDOW_MONTHS = 6;

    @Autowired MarketplaceSalesPerformanceService service;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired UserRepository userRepository;
    @Autowired CategoryRepository categoryRepository;
    @Autowired ProductRepository productRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private UUID buyerOne;
    private UUID buyerTwo;
    private UUID productOne;
    private UUID productTwo;
    private final List<UUID> orderIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        buyerOne = user("gmv-buyer-one");
        buyerTwo = user("gmv-buyer-two");
        UUID categoryOne = category("GMV Category One");
        UUID categoryTwo = category("GMV Category Two");
        productOne = product("GMV Product One", categoryOne);
        productTwo = product("GMV Product Two", categoryTwo);
    }

    @AfterEach
    void tearDown() {
        for (UUID orderId : orderIds) {
            jdbcTemplate.update("DELETE FROM order_items WHERE order_id = ?", orderId);
            jdbcTemplate.update("DELETE FROM orders WHERE id = ?", orderId);
        }
        orderIds.clear();
        productRepository.deleteAll();
        categoryRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void theMonthlySeriesCoversEveryMonthInTheWindowIncludingTheOnesWithNoTrading() {
        givenTradingFixture();

        List<GmvPointDto> months = report().getSeries();

        // The three middle months of the fixture have no orders at all.
        assertThat(months).hasSize(WINDOW_MONTHS);
        assertThat(months).extracting(GmvPointDto::getPeriod)
                .containsExactly(
                        periodKey(5), periodKey(4), periodKey(3),
                        periodKey(2), periodKey(1), periodKey(0));
        assertThat(months).allSatisfy(month -> assertThat(month.getLabel()).isNotBlank());
    }

    /** A month with nothing in it reads as a zero, not as a gap the line chart draws straight through. */
    @Test
    void aMonthWithoutOrdersIsReportedAsZeroRatherThanOmitted() {
        givenTradingFixture();

        List<GmvPointDto> months = report().getSeries();

        for (int monthsBack : List.of(4, 3, 2)) {
            GmvPointDto quiet = months.get(indexOfMonth(months, periodKey(monthsBack)));
            assertThat(quiet.getGmv()).isEqualByComparingTo("0.00");
            assertThat(quiet.getOrderCount()).isZero();
            assertThat(quiet.getUnitCount()).isZero();
            assertThat(quiet.getAverageOrderValue()).isEqualByComparingTo("0.00");
        }
    }

    /** Each month holds only the orders placed in that month, and the months add up to the headline. */
    @Test
    void everyMonthsValueIsTheSumOfTheOrdersPlacedInItAndTheMonthsAddUpToTheHeadline() {
        givenTradingFixture();

        MarketplaceSalesPerformanceDto report = report();
        List<GmvPointDto> months = report.getSeries();

        assertThat(monthValue(months, periodKey(5))).isEqualByComparingTo("400.00");
        assertThat(monthValue(months, periodKey(1))).isEqualByComparingTo("300.00");
        assertThat(monthValue(months, periodKey(0))).isEqualByComparingTo("150.00");

        assertThat(months.stream().map(GmvPointDto::getGmv).reduce(BigDecimal.ZERO, BigDecimal::add))
                .isEqualByComparingTo(report.getGmv());
        assertThat(months.stream().mapToLong(GmvPointDto::getOrderCount).sum())
                .isEqualTo(report.getOrderCount());
    }

    /** The current month mixes a delivered and a refunded order, so this is the two together. */
    @Test
    void refundedOrdersStayInsideGmvButCancelledOnesDoNot() {
        givenTradingFixture();

        MarketplaceSalesPerformanceDto report = report();

        // 100 delivered + 300 shipped + 400 pending + 50 refunded. The 200 cancelled is out.
        assertThat(report.getGmv()).isEqualByComparingTo("850.00");
        assertThat(report.getOrderCount()).isEqualTo(4);
        assertThat(report.getUnitCount()).isEqualTo(4);
        assertThat(report.getBuyerCount()).isEqualTo(2);
        assertThat(report.getAverageOrderValue()).isEqualByComparingTo("212.50");

        assertThat(report.getCancelledOrderCount()).isEqualTo(1);
        assertThat(report.getCancelledAmount()).isEqualByComparingTo("200.00");
        assertThat(report.getRefundedOrderCount()).isEqualTo(1);
        assertThat(report.getRefundedAmount()).isEqualByComparingTo("50.00");
    }

    /** Growth is measured against the window immediately before, not against all time. */
    @Test
    void growthIsMeasuredAgainstThePrecedingWindowOfEqualLength() {
        givenTradingFixture();

        MarketplaceSalesPerformanceDto report = report();

        assertThat(report.getPreviousPeriodGmv()).isEqualByComparingTo("500.00");
        assertThat(report.getPreviousPeriodOrderCount()).isEqualTo(1);
        assertThat(report.getGmvGrowthPercent()).isEqualTo(70.0);
        assertThat(report.getOrderGrowthPercent()).isEqualTo(300.0);
    }

    /** Orders outside both windows still count towards lifetime, and towards nothing else. */
    @Test
    void ordersOutsideTheWindowCountTowardsLifetimeOnly() {
        givenTradingFixture();

        MarketplaceSalesPerformanceDto report = report();

        // 850 in the window + 500 in the previous window + 700 older than both.
        assertThat(report.getLifetimeGmv()).isEqualByComparingTo("2050.00");
        assertThat(report.getLifetimeOrderCount()).isEqualTo(6);
    }

    @Test
    void thePeakMonthIsTheHighestMonthThatActuallyTraded() {
        givenTradingFixture();

        MarketplaceSalesPerformanceDto report = report();

        assertThat(report.getPeakPeriod()).isNotNull();
        assertThat(report.getPeakPeriod().getPeriod()).isEqualTo(periodKey(5));
        assertThat(report.getPeakPeriod().getGmv()).isEqualByComparingTo("400.00");
    }

    @Test
    void theCategoryBreakdownExcludesCancelledLinesAndItsSharesAddUpToTheWhole() {
        givenTradingFixture();

        MarketplaceSalesPerformanceDto report = report();

        // The cancelled wholesale order carried the only "GMV Category Two" line.
        assertThat(report.getCategorySales()).hasSize(1);
        assertThat(report.getCategorySales().get(0).getCategoryName()).isEqualTo("GMV Category One");
        assertThat(report.getCategorySales().get(0).getTotalRevenue()).isEqualByComparingTo("400.00");
        assertThat(report.getCategorySales().get(0).getSalesCount()).isEqualTo(4);
        assertThat(report.getCategorySales().get(0).getPercentage()).isEqualTo(100.0);
    }

    @Test
    void theTopProductsAndCitiesAreRankedByValueAndSkipCancelledOrders() {
        givenTradingFixture();

        MarketplaceSalesPerformanceDto report = report();

        assertThat(report.getTopProducts()).hasSize(1);
        assertThat(report.getTopProducts().get(0).getUnitsSold()).isEqualTo(4);
        assertThat(report.getTopProducts().get(0).getTotalRevenue()).isEqualByComparingTo("400.00");

        assertThat(report.getTopCities()).extracting(CityGmvDto::getCity)
                .containsExactly("Chattogram", "Dhaka");
        assertThat(report.getTopCities().get(0).getGmv()).isEqualByComparingTo("700.00");
    }

    @Test
    void theOrderStateMixAccountsForEveryOrderPlacedIncludingTheCancelledOnes() {
        givenTradingFixture();

        List<OrderStatusGmvDto> mix = report().getOrderStatusMix();

        // Fulfilment order, so the mix reads as orders progressing.
        assertThat(mix).extracting(OrderStatusGmvDto::getStatus)
                .containsExactly("PENDING", "SHIPPED", "DELIVERED", "REFUNDED", "CANCELLED");
        assertThat(mix.stream().mapToLong(OrderStatusGmvDto::getOrderCount).sum())
                .isEqualTo(5);
    }

    @Test
    void thePurchaseMechanismBreakdownSplitsGmvByOrderType() {
        givenTradingFixture();

        List<FeatureGmvDto> features = report().getGmvByFeature();

        assertThat(features).extracting(FeatureGmvDto::getFeature)
                .containsExactly("STANDARD", "GROUP_BUY", "AUCTION");
        assertThat(features).extracting(FeatureGmvDto::getGmv)
                .containsExactly(new BigDecimal("500.00"), new BigDecimal("300.00"), new BigDecimal("50.00"));
        // The cancelled wholesale order must not appear as a mechanism.
        assertThat(features).extracting(FeatureGmvDto::getFeature).doesNotContain("WHOLESALE");
        assertThat(features.stream().mapToDouble(FeatureGmvDto::getPercentage).sum())
                .isCloseTo(100.0, within(0.5));
    }

    @Test
    void thePaymentBreakdownReportsTheGatewayEachOrderCompletedOn() {
        givenTradingFixture();

        List<BreakdownGmvDto> payments = report().getGmvByPaymentMethod();

        assertThat(payments).extracting(BreakdownGmvDto::getName)
                .containsExactlyInAnyOrder("CREDIT_CARD", "STRIPE", "PAYPAL");
        assertThat(payments).extracting(BreakdownGmvDto::getLabel)
                .contains("Credit card", "Stripe", "PayPal");
    }

    @Test
    void theHeadlineBreakdownReconstructsTheOrderValue() {
        givenTradingFixture();

        MarketplaceSalesPerformanceDto report = report();

        assertThat(report.getNetMerchandiseValue()).isEqualByComparingTo("850.00");
        assertThat(report.getDiscountAmount()).isEqualByComparingTo("25.00");
        assertThat(report.getTaxAmount()).isEqualByComparingTo("10.00");
        assertThat(report.getShippingAmount()).isEqualByComparingTo("50.00");
    }

    /** An empty platform must produce an empty report, not a divide-by-zero or a null series. */
    @Test
    void aPlatformWithNoOrdersReportsZeroesRatherThanFailing() {
        MarketplaceSalesPerformanceDto report = service.getSalesPerformance(Granularity.MONTH, WINDOW_MONTHS);

        assertThat(report.getGmv()).isEqualByComparingTo("0.00");
        assertThat(report.getOrderCount()).isZero();
        assertThat(report.getSeries()).hasSize(WINDOW_MONTHS);
        assertThat(report.getSeries()).allSatisfy(month -> {
            assertThat(month.getGmv()).isEqualByComparingTo("0.00");
            assertThat(month.getBuyerCount()).isZero();
        });
        assertThat(report.getPeakPeriod()).isNull();
        assertThat(report.getCategorySales()).isEmpty();
        assertThat(report.getTopProducts()).isEmpty();
        assertThat(report.getTopCities()).isEmpty();
    }

    /** Growth off an empty base is "no comparison", not "flat" - reporting 0% would claim flatness. */
    @Test
    void growthIsNullWhenThePrecedingWindowHadNoTrade() {
        UUID orderId = order(buyerOne, OrderStatus.DELIVERED, "STANDARD", "CASH_ON_DELIVERY",
                "Dhaka", "200.00", "200.00", "0.00", "0.00", "0.00", periodStart(0));

        MarketplaceSalesPerformanceDto report = service.getSalesPerformance(Granularity.MONTH, 1);

        assertThat(report.getPreviousPeriodGmv()).isEqualByComparingTo("0.00");
        assertThat(report.getGmvGrowthPercent()).isNull();
        assertThat(report.getOrderGrowthPercent()).isNull();
        assertThat(report.getGmv()).isEqualByComparingTo("200.00");
        assertThat(orderId).isNotNull();
    }

    /**
     * The point of the day view: several orders inside one calendar month must land in separate
     * daily buckets instead of collapsing into a single bar.
     */
    @Test
    void dailyBucketsSeparateOrdersThatMonthlyBucketsWouldMerge() {
        givenTradingFixture();

        MarketplaceSalesPerformanceDto daily = service.getSalesPerformance(Granularity.DAY, 30);

        assertThat(daily.getGranularity()).isEqualTo("DAY");
        assertThat(daily.getBucketUnit()).isEqualTo("days");
        assertThat(daily.getBucketCount()).isEqualTo(30);

        // Same orders in the same months, but a 30-day window only reaches back to this month, so
        // the two older orders drop out of the totals. That is the point: the day view trades
        // history for shape, and the window follows the bucket count.
        assertThat(daily.getGmv()).isEqualByComparingTo("150.00");
        assertThat(daily.getOrderCount()).isEqualTo(2);
        assertThat(daily.getSeries()).hasSize(30);
        assertThat(daily.getSeries().stream().map(GmvPointDto::getPeriod))
                .doesNotHaveDuplicates();
        assertThat(daily.getSeries().stream().map(GmvPointDto::getPeriod))
                .isSorted();
    }

    /** Two orders in the same month but different days produce two populated daily buckets. */
    @Test
    void ordersOnDifferentDaysInTheSameMonthEndUpInDifferentDailyBuckets() {
        LocalDateTime firstDay = periodStart(0).plusDays(1);
        LocalDateTime secondDay = periodStart(0).plusDays(2);
        order(buyerOne, OrderStatus.DELIVERED, "STANDARD", "CASH_ON_DELIVERY",
                "Dhaka", "100.00", "100.00", "0.00", "0.00", "0.00", firstDay);
        order(buyerTwo, OrderStatus.DELIVERED, "STANDARD", "CASH_ON_DELIVERY",
                "Dhaka", "250.00", "250.00", "0.00", "0.00", "0.00", secondDay);

        List<GmvPointDto> daily = service.getSalesPerformance(Granularity.DAY, 30).getSeries();

        // Both sit in the current month, so a monthly view would show one bar of 350.
        assertThat(daily).filteredOn(point -> num(point.getGmv()) > 0).hasSize(2);
        assertThat(daily.stream().map(GmvPointDto::getGmv)
                .reduce(BigDecimal.ZERO, BigDecimal::add))
                .isEqualByComparingTo("350.00");

        // Month buckets still merge them, which is the behaviour the day view exists to resolve.
        List<GmvPointDto> monthly = service.getSalesPerformance(Granularity.MONTH, 3).getSeries();
        assertThat(monthly).filteredOn(point -> num(point.getGmv()) > 0).hasSize(1);
    }

    /** A week never straddles two week numbers, and the keys stay sortable as text. */
    @Test
    void weeklyBucketsStartOnMondayAndProduceSortableIsoKeys() {
        givenTradingFixture();

        MarketplaceSalesPerformanceDto weekly = service.getSalesPerformance(Granularity.WEEK, 12);

        assertThat(weekly.getGranularity()).isEqualTo("WEEK");
        assertThat(weekly.getBucketUnit()).isEqualTo("weeks");
        assertThat(weekly.getSeries()).hasSize(12);
        assertThat(weekly.getSeries()).allSatisfy(point -> {
            assertThat(point.getPeriod()).matches("\\d{4}-W\\d{2}");
            assertThat(point.getPeriodStart().getDayOfWeek())
                    .isEqualTo(java.time.DayOfWeek.MONDAY);
        });
        assertThat(weekly.getSeries().stream().map(GmvPointDto::getPeriod)).isSorted();
    }

    /** How far through the final bucket the window reaches, so the newest point is not misread. */
    @Test
    void theReportSaysHowMuchOfTheFinalBucketHasElapsed() {
        givenTradingFixture();

        int daily = service.getSalesPerformance(Granularity.DAY, 30).getLastBucketProgressPercent();
        int monthly = service.getSalesPerformance(Granularity.MONTH, 6).getLastBucketProgressPercent();

        // A series ending "now" is always mid-bucket, and the figure has to describe how mid.
        assertThat(daily).isBetween(0, 100);
        assertThat(monthly).isBetween(0, 100);
        assertThat(daily).isGreaterThan(0);
        // A month is always further through than a day at the same instant on the 30th.
        assertThat(monthly).isGreaterThanOrEqualTo(daily);
    }

    @Test
    void anOutOfRangeBucketCountIsClampedToWhatMakesSenseForTheGranularity() {
        assertThat(service.getSalesPerformance(Granularity.MONTH, 0).getBucketCount()).isEqualTo(1);
        assertThat(service.getSalesPerformance(Granularity.MONTH, -5).getBucketCount()).isEqualTo(1);
        assertThat(service.getSalesPerformance(Granularity.MONTH, 10_000).getBucketCount()).isEqualTo(60);

        // Days can go further, and a single day is a meaningful request.
        assertThat(service.getSalesPerformance(Granularity.DAY, 0).getBucketCount()).isEqualTo(1);
        assertThat(service.getSalesPerformance(Granularity.DAY, 10_000).getBucketCount()).isEqualTo(365);

        // Weeks are floored at 4: fewer than a month of weekly buckets is not a trend.
        assertThat(service.getSalesPerformance(Granularity.WEEK, 1).getBucketCount()).isEqualTo(4);
        assertThat(service.getSalesPerformance(Granularity.WEEK, 10_000).getBucketCount()).isEqualTo(156);
    }

    // ----- assertions helpers --------------------------------------------------------------------

    private MarketplaceSalesPerformanceDto report() {
        return service.getSalesPerformance(Granularity.MONTH, WINDOW_MONTHS);
    }

    private static BigDecimal monthValue(List<GmvPointDto> months, String key) {
        return months.stream()
                .filter(month -> month.getPeriod().equals(key))
                .findFirst()
                .orElseThrow()
                .getGmv();
    }

    private static int indexOfMonth(List<GmvPointDto> months, String key) {
        for (int index = 0; index < months.size(); index++) {
            if (months.get(index).getPeriod().equals(key)) {
                return index;
            }
        }
        throw new IllegalArgumentException("Period " + key + " missing from the series");
    }

    private static double num(BigDecimal value) {
        return value == null ? 0d : value.doubleValue();
    }

    /** {@code monthsBack} counts backwards, so 0 is the current month and 5 is five months ago. */
    private static String periodKey(int monthsBack) {
        return YearMonth.now().minusMonths(monthsBack).toString();
    }

    private static LocalDateTime periodStart(int monthsBack) {
        return YearMonth.now().minusMonths(monthsBack).atDay(1).atStartOfDay();
    }

    // ----- fixtures ------------------------------------------------------------------------------

    /**
     * Six months of trading, with the deliberate gaps and the out-of-window rows the assertions rely on.
     *
     * <ul>
     *   <li>this month: 100 delivered (Dhaka, card, standard) and 50 refunded (Dhaka, card, auction)</li>
     *   <li>this month: 200 cancelled (Dhaka, cash, wholesale) - excluded from GMV entirely</li>
     *   <li>one month back: 300 shipped (Chattogram, Stripe, group buy)</li>
     *   <li>five months back: 400 pending (Chattogram, PayPal, standard) - the window's first month</li>
     *   <li>nine months back: 500 delivered - inside the preceding window, outside this one</li>
     *   <li>thirteen months back: 700 delivered - older than either window</li>
     * </ul>
     *
     * <p>Nine and thirteen are both outside the six-month window; the gap between them is what puts
     * the 500 inside the preceding window and the 700 outside both.
     */
    private void givenTradingFixture() {
        UUID delivered = order(buyerOne, OrderStatus.DELIVERED, "STANDARD", "CREDIT_CARD",
                "Dhaka", "100.00", "100.00", "0.00", "10.00", "0.00", periodStart(0));
        item(delivered, productOne, "GMV Product One", 1, "100.00");

        // The cancelled wholesale order deliberately carries a line in the other category, so the
        // category assertion can prove cancelled lines are left out of the breakdown.
        UUID cancelled = order(buyerOne, OrderStatus.CANCELLED, "WHOLESALE", "CASH_ON_DELIVERY",
                "Dhaka", "200.00", "200.00", "0.00", "0.00", "0.00", periodStart(0));
        item(cancelled, productTwo, "GMV Product Two", 1, "200.00");

        UUID shipped = order(buyerTwo, OrderStatus.SHIPPED, "GROUP_BUY", "STRIPE",
                "Chattogram", "300.00", "300.00", "0.00", "0.00", "50.00", periodStart(1));
        item(shipped, productOne, "GMV Product One", 3, "300.00");

        order(buyerTwo, OrderStatus.PENDING, "STANDARD", "PAYPAL",
                "Chattogram", "400.00", "400.00", "25.00", "0.00", "0.00", periodStart(5));

        order(buyerOne, OrderStatus.REFUNDED, "AUCTION", "CREDIT_CARD",
                "Dhaka", "50.00", "50.00", "0.00", "0.00", "0.00", periodStart(0));

        order(buyerOne, OrderStatus.DELIVERED, "STANDARD", "STRIPE",
                "Sylhet", "500.00", "500.00", "0.00", "0.00", "0.00", periodStart(9));

        order(buyerOne, OrderStatus.DELIVERED, "STANDARD", "CREDIT_CARD",
                "Sylhet", "700.00", "700.00", "0.00", "0.00", "0.00", periodStart(13));
    }

    private UUID user(String prefix) {
        User saved = userRepository.save(User.builder()
                .email(prefix + "-" + UUID.randomUUID() + "@gmv.test")
                .password(passwordEncoder.encode("Password@123"))
                .firstName("Gmv")
                .lastName("Fixture")
                .role(Role.ROLE_CUSTOMER)
                .sellerStatus(SellerStatus.NONE)
                .enabled(true)
                .build());
        return saved.getId();
    }

    private UUID category(String name) {
        String unique = name + "-" + UUID.randomUUID();
        Category saved = categoryRepository.save(Category.builder()
                .name(name)
                .slug(unique.toLowerCase().replace(' ', '-'))
                .description("GMV rollup fixture")
                .active(true)
                .build());
        return saved.getId();
    }

    private UUID product(String name, UUID categoryId) {
        Category category = categoryRepository.findById(categoryId).orElseThrow();
        return productRepository.save(Product.builder()
                .name(name)
                .sku("GMV-" + UUID.randomUUID())
                .slug("gmv-product-" + UUID.randomUUID())
                .description("GMV rollup fixture")
                .price(new BigDecimal("100.00"))
                .category(category)
                .stockQuantity(50)
                .active(true)
                .build()).getId();
    }

    private UUID order(UUID userId, OrderStatus status, String orderType, String paymentMethod,
                       String city, String total, String subtotal, String discount,
                       String tax, String shipping, LocalDateTime createdAt) {
        UUID id = UUID.randomUUID();
        orderIds.add(id);
        jdbcTemplate.update(
                "INSERT INTO orders (id, order_number, user_id, status, payment_status, payment_method, "
                        + "subtotal_amount, tax_amount, shipping_amount, discount_amount, total_amount, "
                        + "shipping_address_line1, shipping_city, shipping_state, shipping_postal_code, "
                        + "shipping_country, order_type, created_at, updated_at) "
                        + "VALUES (?,?,?,?,'COMPLETED',?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                id,
                "GMV-" + UUID.randomUUID(),
                userId,
                status.name(),
                paymentMethod,
                new BigDecimal(subtotal),
                new BigDecimal(tax),
                new BigDecimal(shipping),
                new BigDecimal(discount),
                new BigDecimal(total),
                "1 Fixture Road",
                city,
                "State",
                "00000",
                "Testland",
                orderType,
                createdAt,
                createdAt);
        return id;
    }

    private void item(UUID orderId, UUID productId, String productName, int quantity, String subtotal) {
        jdbcTemplate.update(
                "INSERT INTO order_items (id, order_id, product_id, product_name, product_sku, "
                        + "quantity, unit_price, subtotal, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                UUID.randomUUID(),
                orderId,
                productId,
                productName,
                "GMV-" + UUID.randomUUID(),
                quantity,
                new BigDecimal(subtotal).divide(BigDecimal.valueOf(quantity), 2, RoundingMode.HALF_UP),
                new BigDecimal(subtotal),
                periodStart(0));
    }
}
