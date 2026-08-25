package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.analytics.*;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.AnalyticsService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnalyticsServiceImpl implements AnalyticsService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final SellerStoreRepository sellerStoreRepository;

    @Override
    @Transactional(readOnly = true)
    public DashboardAnalyticsDto getAdminDashboardAnalytics() {
        List<Order> allOrders = orderRepository.findAll();
        long totalProducts = productRepository.count();
        long totalCustomers = userRepository.count();

        List<Order> validOrders = allOrders.stream()
                .filter(o -> o.getStatus() != OrderStatus.CANCELLED)
                .collect(Collectors.toList());

        BigDecimal totalRevenue = validOrders.stream()
                .map(Order::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long totalOrdersCount = validOrders.size();
        BigDecimal avgOrderValue = totalOrdersCount > 0
                ? totalRevenue.divide(new BigDecimal(totalOrdersCount), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // Group Revenue Trends by Date
        Map<String, BigDecimal> dailyRevenue = new LinkedHashMap<>();
        Map<String, Long> dailyOrderCount = new LinkedHashMap<>();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM dd");

        for (Order order : validOrders) {
            String dateStr = order.getCreatedAt() != null ? order.getCreatedAt().format(formatter) : "Today";
            dailyRevenue.put(dateStr, dailyRevenue.getOrDefault(dateStr, BigDecimal.ZERO).add(order.getTotalAmount()));
            dailyOrderCount.put(dateStr, dailyOrderCount.getOrDefault(dateStr, 0L) + 1);
        }

        List<RevenueTrendDto> trends = dailyRevenue.entrySet().stream()
                .map(entry -> RevenueTrendDto.builder()
                        .date(entry.getKey())
                        .revenue(entry.getValue())
                        .orderCount(dailyOrderCount.getOrDefault(entry.getKey(), 0L))
                        .build())
                .collect(Collectors.toList());

        // Category Sales Breakdown
        Map<String, BigDecimal> categoryRevenue = new HashMap<>();
        Map<String, Long> categoryUnits = new HashMap<>();

        for (Order order : validOrders) {
            for (OrderItem item : order.getItems()) {
                String catName = (item.getProduct() != null && item.getProduct().getCategory() != null)
                        ? item.getProduct().getCategory().getName() : "Uncategorized";
                categoryRevenue.put(catName, categoryRevenue.getOrDefault(catName, BigDecimal.ZERO).add(item.getSubtotal()));
                categoryUnits.put(catName, categoryUnits.getOrDefault(catName, 0L) + item.getQuantity());
            }
        }

        List<CategorySalesDto> categorySalesList = categoryRevenue.entrySet().stream()
                .map(entry -> {
                    BigDecimal catRev = entry.getValue();
                    double pct = totalRevenue.compareTo(BigDecimal.ZERO) > 0
                            ? catRev.divide(totalRevenue, 4, RoundingMode.HALF_UP).doubleValue() * 100.0 : 0.0;
                    return CategorySalesDto.builder()
                            .categoryName(entry.getKey())
                            .salesCount(categoryUnits.getOrDefault(entry.getKey(), 0L))
                            .totalRevenue(catRev)
                            .percentage(Math.round(pct * 10.0) / 10.0)
                            .build();
                }).collect(Collectors.toList());

        // Top Performing Products
        Map<UUID, TopProductAnalyticsDto> productMap = new HashMap<>();
        for (Order order : validOrders) {
            for (OrderItem item : order.getItems()) {
                if (item.getProduct() != null) {
                    UUID pId = item.getProduct().getId();
                    TopProductAnalyticsDto existing = productMap.get(pId);
                    String img = (item.getProduct().getImageUrls() != null && !item.getProduct().getImageUrls().isEmpty())
                            ? item.getProduct().getImageUrls().get(0) : null;

                    if (existing == null) {
                        productMap.put(pId, TopProductAnalyticsDto.builder()
                                .productId(pId)
                                .productName(item.getProductName())
                                .sku(item.getProductSku())
                                .imageUrl(img)
                                .unitsSold(item.getQuantity())
                                .totalRevenue(item.getSubtotal())
                                .build());
                    } else {
                        existing.setUnitsSold(existing.getUnitsSold() + item.getQuantity());
                        existing.setTotalRevenue(existing.getTotalRevenue().add(item.getSubtotal()));
                    }
                }
            }
        }

        List<TopProductAnalyticsDto> topProducts = productMap.values().stream()
                .sorted(Comparator.comparing(TopProductAnalyticsDto::getTotalRevenue).reversed())
                .limit(5)
                .collect(Collectors.toList());

        return DashboardAnalyticsDto.builder()
                .totalRevenue(totalRevenue)
                .totalOrders(totalOrdersCount)
                .totalCustomers(totalCustomers)
                .totalProducts(totalProducts)
                .averageOrderValue(avgOrderValue)
                .revenueTrends(trends)
                .categorySales(categorySalesList)
                .topProducts(topProducts)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public DashboardAnalyticsDto getSellerDashboardAnalytics(String sellerEmail) {
        User user = userRepository.findByEmail(sellerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", sellerEmail));

        SellerStore store = sellerStoreRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("SellerStore", "userId", user.getId()));

        List<OrderItem> merchantItems = orderItemRepository.findBySellerStoreIdOrderByCreatedAtDesc(store.getId());

        List<OrderItem> validItems = merchantItems.stream()
                .filter(i -> i.getOrder().getStatus() != OrderStatus.CANCELLED)
                .collect(Collectors.toList());

        BigDecimal totalRevenue = validItems.stream()
                .map(OrderItem::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long merchantOrdersCount = validItems.stream().map(i -> i.getOrder().getId()).distinct().count();
        long merchantProductsCount = productRepository.findBySellerStoreId(store.getId()).size();

        BigDecimal avgOrderValue = merchantOrdersCount > 0
                ? totalRevenue.divide(new BigDecimal(merchantOrdersCount), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return DashboardAnalyticsDto.builder()
                .totalRevenue(totalRevenue)
                .totalOrders(merchantOrdersCount)
                .totalCustomers(merchantOrdersCount)
                .totalProducts(merchantProductsCount)
                .averageOrderValue(avgOrderValue)
                .revenueTrends(List.of())
                .categorySales(List.of())
                .topProducts(List.of())
                .build();
    }
}
