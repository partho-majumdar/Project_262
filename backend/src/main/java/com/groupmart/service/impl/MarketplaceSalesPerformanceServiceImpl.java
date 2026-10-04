package com.groupmart.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.dto.analytics.CategorySalesDto;
import com.groupmart.dto.analytics.TopProductAnalyticsDto;
import com.groupmart.dto.analytics.sales.BreakdownGmvDto;
import com.groupmart.dto.analytics.sales.CityGmvDto;
import com.groupmart.dto.analytics.sales.FeatureGmvDto;
import com.groupmart.dto.analytics.sales.Granularity;
import com.groupmart.dto.analytics.sales.GmvPointDto;
import com.groupmart.dto.analytics.sales.GmvTotal;
import com.groupmart.dto.analytics.sales.MarketplaceSalesPerformanceDto;
import com.groupmart.dto.analytics.sales.OrderItemFact;
import com.groupmart.dto.analytics.sales.OrderStatusGmvDto;
import com.groupmart.entity.Order;
import com.groupmart.entity.OrderStatus;
import com.groupmart.entity.OrderType;
import com.groupmart.entity.PaymentMethod;
import com.groupmart.repository.OrderItemRepository;
import com.groupmart.repository.OrderRepository;
import com.groupmart.service.MarketplaceSalesPerformanceService;

import lombok.RequiredArgsConstructor;

/**
 * Builds the marketplace GMV report from order data.
 *
 * <p>Reads through four queries - window orders with their buyer, window order lines flattened with
 * product and category names, one aggregate for the previous window, one for lifetime - rather than
 * walking the order graph, which would issue a query per lazy association touched.
 *
 * <p>The series is bucketed by {@link Granularity}, so day, week and month views share one code
 * path and one set of definitions. Every bucket in the window is emitted, including empty ones.
 *
 * <p>GMV is the order value placed, excluding cancelled orders only. Refunded orders stay in: a
 * return follows a placed sale, and dropping it would make the series move for orders that were
 * never cancelled. That is the same rule the older {@code /admin/analytics} rollup uses, so the
 * two panels reconcile.
 */
@Service
@RequiredArgsConstructor
public class MarketplaceSalesPerformanceServiceImpl implements MarketplaceSalesPerformanceService {

    private static final int TOP_PRODUCT_LIMIT = 10;
    private static final int TOP_CITY_LIMIT = 10;
    private static final Granularity DEFAULT_GRANULARITY = Granularity.MONTH;
    private static final int DEFAULT_BUCKETS = 12;

    /** Matches the placeholder the older rollup already uses, so both category charts agree. */
    private static final String UNCATEGORISED = "Uncategorized";
    private static final String UNSPECIFIED = "UNSPECIFIED";
    private static final String UNNAMED_PRODUCT = "Unnamed product";

    private static final Map<String, String> FEATURE_LABELS = Map.of(
            "STANDARD", "Regular orders",
            "GROUP_BUY", "Group buying",
            "WHOLESALE", "Wholesale (CWP)",
            "REVERSE_GROUP_BUYING", "Seller reverse buying",
            "GROUP_BUYING_AUCTION", "Group buying auction",
            "AUCTION", "Proxy auction",
            "GROUP_REVERSE_BUYING", "Group reverse buying");

    private static final Map<String, String> PAYMENT_LABELS = Map.of(
            "CREDIT_CARD", "Credit card",
            "DEBIT_CARD", "Debit card",
            "PAYPAL", "PayPal",
            "STRIPE", "Stripe",
            "CASH_ON_DELIVERY", "Cash on delivery");

    private static final Map<String, String> STATUS_LABELS = Map.of(
            "PENDING", "Pending",
            "PROCESSING", "Processing",
            "SHIPPED", "Shipped",
            "DELIVERED", "Delivered",
            "REFUNDED", "Refunded",
            "CANCELLED", "Cancelled");

    /** Fulfilment order, so the mix reads left to right as orders progress. */
    private static final List<String> STATUS_ORDER =
            List.of("PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "REFUNDED", "CANCELLED");

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;

    @Override
    @Transactional(readOnly = true)
    public MarketplaceSalesPerformanceDto getSalesPerformance(Granularity requestedGranularity, int requestedBuckets) {
        Granularity granularity = requestedGranularity == null ? DEFAULT_GRANULARITY : requestedGranularity;
        int bucketCount = granularity.clampBuckets(requestedBuckets);

        LocalDateTime now = LocalDateTime.now();
        LocalDate lastBucketStart = granularity.bucketStart(now.toLocalDate());
        LocalDate firstBucketStart = granularity.shift(lastBucketStart, -(bucketCount - 1));
        LocalDateTime periodStart = firstBucketStart.atStartOfDay();
        // Half-open against periodStart, so the two windows tile without overlapping or leaving a gap.
        LocalDateTime previousStart = granularity.shift(firstBucketStart, -bucketCount).atStartOfDay();

        Map<LocalDate, PeriodTally> buckets = new LinkedHashMap<>();
        for (LocalDate cursor = firstBucketStart;
                !cursor.isAfter(lastBucketStart);
                cursor = granularity.shift(cursor, 1)) {
            buckets.put(cursor, new PeriodTally());
        }
        // Only worth disambiguating when the series actually crosses a year boundary.
        boolean includeYear = firstBucketStart.getYear() != lastBucketStart.getYear();

        Map<String, DimensionTally> byFeature = new HashMap<>();
        Map<String, DimensionTally> byPayment = new HashMap<>();
        Map<String, DimensionTally> byCategory = new HashMap<>();
        Map<String, DimensionTally> byCity = new HashMap<>();
        Map<String, DimensionTally> byStatus = new HashMap<>();
        Map<UUID, TopProductAnalyticsDto> byProduct = new LinkedHashMap<>();
        Map<UUID, LocalDate> orderBucket = new HashMap<>();
        Set<UUID> buyers = new HashSet<>();

        BigDecimal gmv = BigDecimal.ZERO;
        BigDecimal netMerchandise = BigDecimal.ZERO;
        BigDecimal discounts = BigDecimal.ZERO;
        BigDecimal taxes = BigDecimal.ZERO;
        BigDecimal shipping = BigDecimal.ZERO;
        long orderCount = 0;
        long unitCount = 0;
        long cancelledOrders = 0;
        BigDecimal cancelledAmount = BigDecimal.ZERO;
        long refundedOrders = 0;
        BigDecimal refundedAmount = BigDecimal.ZERO;

        List<Order> windowOrders = orderRepository.findForAnalytics(periodStart, now);
        for (Order order : windowOrders) {
            if (order == null) {
                continue;
            }
            OrderStatus status = order.getStatus() == null ? OrderStatus.PENDING : order.getStatus();
            BigDecimal total = money(order.getTotalAmount());

            // Every order in the window appears in the state mix, cancelled ones included, so the
            // states always add back up to the number of orders placed.
            byStatus.computeIfAbsent(status.name(), key -> new DimensionTally()).add(total, 1, 0);

            if (status == OrderStatus.CANCELLED) {
                cancelledOrders++;
                cancelledAmount = cancelledAmount.add(total);
                continue;
            }
            if (status == OrderStatus.REFUNDED) {
                refundedOrders++;
                refundedAmount = refundedAmount.add(total);
            }

            LocalDate bucketStart = order.getCreatedAt() == null
                    ? null
                    : granularity.bucketStart(order.getCreatedAt().toLocalDate());
            if (order.getId() != null && bucketStart != null) {
                orderBucket.put(order.getId(), bucketStart);
            }
            PeriodTally bucketTally = bucketStart == null ? null
                    : buckets.computeIfAbsent(bucketStart, key -> new PeriodTally());

            gmv = gmv.add(total);
            orderCount++;
            netMerchandise = netMerchandise.add(money(order.getSubtotalAmount()));
            discounts = discounts.add(money(order.getDiscountAmount()));
            taxes = taxes.add(money(order.getTaxAmount()));
            shipping = shipping.add(money(order.getShippingAmount()));

            UUID buyerId = order.getUser() == null ? null : order.getUser().getId();
            if (buyerId != null) {
                buyers.add(buyerId);
                if (bucketTally != null) {
                    bucketTally.buyers.add(buyerId);
                }
            }
            if (bucketTally != null) {
                bucketTally.amount = bucketTally.amount.add(total);
                bucketTally.discount = bucketTally.discount.add(money(order.getDiscountAmount()));
                bucketTally.count++;
            }

            byFeature.computeIfAbsent(featureKey(order), key -> new DimensionTally()).add(total, 1, 0);
            byPayment.computeIfAbsent(paymentKey(order), key -> new DimensionTally()).add(total, 1, 0);

            String city = text(order.getShippingCity());
            if (!city.isEmpty()) {
                byCity.computeIfAbsent(city, key -> new DimensionTally()).add(total, 1, 0);
            }
        }

        for (OrderItemFact fact : orderItemRepository.findItemFactsForAnalytics(periodStart, now)) {
            if (fact == null) {
                continue;
            }
            int quantity = Math.max(fact.getQuantity(), 0);
            BigDecimal subtotal = money(fact.getSubtotal());

            unitCount += quantity;
            LocalDate bucketStart = fact.getOrderId() == null ? null : orderBucket.get(fact.getOrderId());
            if (bucketStart != null) {
                buckets.computeIfAbsent(bucketStart, key -> new PeriodTally()).units += quantity;
            }

            byCategory.computeIfAbsent(fallback(fact.getCategoryName(), UNCATEGORISED), key -> new DimensionTally())
                    .add(subtotal, 0, quantity);

            UUID productId = fact.getProductId();
            if (productId != null) {
                TopProductAnalyticsDto product = byProduct.get(productId);
                if (product == null) {
                    product = TopProductAnalyticsDto.builder()
                            .productId(productId)
                            .productName(fallback(fact.getProductName(), UNNAMED_PRODUCT))
                            .sku(fact.getSku())
                            .unitsSold(0)
                            .totalRevenue(BigDecimal.ZERO)
                            .build();
                    byProduct.put(productId, product);
                }
                product.setUnitsSold(product.getUnitsSold() + quantity);
                product.setTotalRevenue(product.getTotalRevenue().add(subtotal));
            }
        }

        List<GmvPointDto> series = buckets.entrySet().stream()
                .map(entry -> toPoint(granularity, entry.getKey(), entry.getValue(), includeYear))
                .sorted(Comparator.comparing(GmvPointDto::getPeriod))
                .toList();

        GmvTotal previous = orderRepository.sumNonCancelledBetween(previousStart, periodStart);
        BigDecimal previousGmv = previous == null ? BigDecimal.ZERO : money(previous.getGmv());
        long previousOrders = previous == null ? 0L : previous.getOrderCount();

        GmvTotal lifetime = orderRepository.sumNonCancelled();

        return MarketplaceSalesPerformanceDto.builder()
                .generatedAt(now)
                .periodStart(periodStart)
                .periodEnd(now)
                .granularity(granularity.name())
                .bucketCount(series.size())
                .bucketUnit(granularity.unit())
                .gmv(money(gmv))
                .orderCount(orderCount)
                .unitCount(unitCount)
                .buyerCount(buyers.size())
                .averageOrderValue(average(gmv, orderCount))
                .netMerchandiseValue(money(netMerchandise))
                .discountAmount(money(discounts))
                .taxAmount(money(taxes))
                .shippingAmount(money(shipping))
                .cancelledOrderCount(cancelledOrders)
                .cancelledAmount(money(cancelledAmount))
                .refundedOrderCount(refundedOrders)
                .refundedAmount(money(refundedAmount))
                .previousPeriodGmv(previousGmv)
                .previousPeriodOrderCount(previousOrders)
                .gmvGrowthPercent(percentChange(gmv, previousGmv))
                .orderGrowthPercent(percentChange(BigDecimal.valueOf(orderCount), BigDecimal.valueOf(previousOrders)))
                .peakPeriod(peakOf(series))
                .lastBucketProgressPercent(bucketProgress(granularity, lastBucketStart, now))
                .series(series)
                .gmvByFeature(featureBreakdown(byFeature, gmv))
                .gmvByPaymentMethod(paymentBreakdown(byPayment, gmv))
                .categorySales(categoryBreakdown(byCategory))
                .topProducts(topProducts(byProduct))
                .topCities(topCities(byCity))
                .orderStatusMix(statusMix(byStatus))
                .lifetimeGmv(lifetime == null ? BigDecimal.ZERO : money(lifetime.getGmv()))
                .lifetimeOrderCount(lifetime == null ? 0L : lifetime.getOrderCount())
                .build();
    }

    private static GmvPointDto toPoint(Granularity granularity, LocalDate bucketStart,
                                       PeriodTally tally, boolean includeYear) {
        BigDecimal amount = money(tally.amount);
        return GmvPointDto.builder()
                .period(granularity.key(bucketStart))
                .label(granularity.label(bucketStart, includeYear))
                .gmv(amount)
                .orderCount(tally.count)
                .unitCount(tally.units)
                .buyerCount(tally.buyers.size())
                .averageOrderValue(average(amount, tally.count))
                .discountAmount(money(tally.discount))
                .periodStart(bucketStart)
                .build();
    }

    /** Highest bucket that actually traded, or null so the client can say "no trading yet". */
    private static GmvPointDto peakOf(List<GmvPointDto> series) {
        return series.stream()
                .filter(point -> point.getGmv() != null && point.getGmv().signum() > 0)
                .max(Comparator.comparing(GmvPointDto::getGmv))
                .orElse(null);
    }

    /**
     * How much of the final bucket has elapsed, as a whole-number percentage.
     *
     * <p>Measured against the bucket's own full width rather than a per-granularity guess, so a
     * 31-day month and a 7-day week are each judged against their real length.
     */
    private static int bucketProgress(Granularity granularity, LocalDate lastBucketStart, LocalDateTime now) {
        LocalDateTime bucketOpen = lastBucketStart.atStartOfDay();
        LocalDateTime bucketClose = granularity.shift(lastBucketStart, 1).atStartOfDay();
        long widthMillis = Duration.between(bucketOpen, bucketClose).toMillis();
        if (widthMillis <= 0) {
            return 100;
        }
        long elapsedMillis = Duration.between(bucketOpen, now).toMillis();
        long percent = Math.round(elapsedMillis * 100.0 / widthMillis);
        return (int) Math.min(100, Math.max(0, percent));
    }

    private static List<FeatureGmvDto> featureBreakdown(Map<String, DimensionTally> source, BigDecimal base) {
        return source.entrySet().stream()
                .map(entry -> FeatureGmvDto.builder()
                        .feature(entry.getKey())
                        .label(FEATURE_LABELS.getOrDefault(entry.getKey(), entry.getKey()))
                        .gmv(money(entry.getValue().amount))
                        .orderCount(entry.getValue().count)
                        .percentage(percent(entry.getValue().amount, base))
                        .build())
                .sorted(Comparator.comparing(FeatureGmvDto::getGmv).reversed())
                .toList();
    }

    private static List<BreakdownGmvDto> paymentBreakdown(Map<String, DimensionTally> source, BigDecimal base) {
        return source.entrySet().stream()
                .map(entry -> BreakdownGmvDto.builder()
                        .name(entry.getKey())
                        .label(PAYMENT_LABELS.getOrDefault(entry.getKey(), titleCase(entry.getKey())))
                        .gmv(money(entry.getValue().amount))
                        .orderCount(entry.getValue().count)
                        .percentage(percent(entry.getValue().amount, base))
                        .build())
                .sorted(Comparator.comparing(BreakdownGmvDto::getGmv).reversed())
                .toList();
    }

    /**
     * Category share is taken against the summed line value, not order GMV.
     *
     * <p>Line subtotals exclude tax and shipping, so dividing them by GMV would leave the shares
     * adding up to noticeably less than 100 and a donut whose slices do not fill the ring.
     */
    private static List<CategorySalesDto> categoryBreakdown(Map<String, DimensionTally> source) {
        BigDecimal base = source.values().stream()
                .map(tally -> tally.amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return source.entrySet().stream()
                .map(entry -> CategorySalesDto.builder()
                        .categoryName(entry.getKey())
                        .salesCount(entry.getValue().units)
                        .totalRevenue(money(entry.getValue().amount))
                        .percentage(percent(entry.getValue().amount, base))
                        .build())
                .sorted(Comparator.comparing(CategorySalesDto::getTotalRevenue).reversed())
                .toList();
    }

    private static List<TopProductAnalyticsDto> topProducts(Map<UUID, TopProductAnalyticsDto> source) {
        return source.values().stream()
                .filter(product -> product.getTotalRevenue() != null
                        && product.getTotalRevenue().signum() > 0)
                .sorted(Comparator.comparing(TopProductAnalyticsDto::getTotalRevenue).reversed())
                .limit(TOP_PRODUCT_LIMIT)
                .toList();
    }

    private static List<CityGmvDto> topCities(Map<String, DimensionTally> source) {
        return source.entrySet().stream()
                .map(entry -> CityGmvDto.builder()
                        .city(entry.getKey())
                        .gmv(money(entry.getValue().amount))
                        .orderCount(entry.getValue().count)
                        .build())
                .sorted(Comparator.comparing(CityGmvDto::getGmv).reversed())
                .limit(TOP_CITY_LIMIT)
                .toList();
    }

    private static List<OrderStatusGmvDto> statusMix(Map<String, DimensionTally> source) {
        return source.entrySet().stream()
                .map(entry -> OrderStatusGmvDto.builder()
                        .status(entry.getKey())
                        .label(STATUS_LABELS.getOrDefault(entry.getKey(), titleCase(entry.getKey())))
                        .orderCount(entry.getValue().count)
                        .amount(money(entry.getValue().amount))
                        .build())
                .sorted(Comparator.comparingInt(status -> {
                    int rank = STATUS_ORDER.indexOf(status.getStatus());
                    return rank < 0 ? STATUS_ORDER.size() : rank;
                }))
                .toList();
    }

    private static String featureKey(Order order) {
        OrderType type = order.getOrderType();
        return (type == null ? OrderType.STANDARD : type).name();
    }

    private static String paymentKey(Order order) {
        PaymentMethod method = order.getPaymentMethod();
        return method == null ? UNSPECIFIED : method.name();
    }

    /** Fallback label for an enum value this report has no wording for. */
    private static String titleCase(String constant) {
        return constant.replace('_', ' ').toLowerCase(Locale.ENGLISH);
    }

    private static BigDecimal average(BigDecimal amount, long orders) {
        if (orders <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return money(amount).divide(BigDecimal.valueOf(orders), 2, RoundingMode.HALF_UP);
    }

    /**
     * Percentage change between two amounts, or null when there is no base to divide by.
     *
     * <p>Null rather than zero: growth off an empty previous window is "no comparison available",
     * and rendering it as 0% would read as "flat" - a claim the data does not support.
     */
    private static Double percentChange(BigDecimal current, BigDecimal previous) {
        if (previous == null || previous.signum() == 0) {
            return null;
        }
        return current.subtract(previous)
                .multiply(BigDecimal.valueOf(100))
                .divide(previous, 1, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private static double percent(BigDecimal value, BigDecimal base) {
        if (base == null || base.signum() <= 0) {
            return 0.0;
        }
        return value.multiply(BigDecimal.valueOf(100))
                .divide(base, 1, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private static BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private static String text(String value) {
        return value == null ? "" : value.trim();
    }

    private static String fallback(String value, String fallback) {
        String trimmed = text(value);
        return trimmed.isEmpty() ? fallback : trimmed;
    }

    /** Running totals for one dimension key. */
    private static final class DimensionTally {

        private BigDecimal amount = BigDecimal.ZERO;
        private long count;
        private long units;

        private void add(BigDecimal value, long orders, long itemUnits) {
            amount = amount.add(value);
            count += orders;
            units += itemUnits;
        }
    }

    /** Per-bucket running totals, including who bought in that bucket. */
    private static final class PeriodTally {

        private BigDecimal amount = BigDecimal.ZERO;
        private BigDecimal discount = BigDecimal.ZERO;
        private long count;
        private long units;
        private final Set<UUID> buyers = new HashSet<>();
    }
}
