package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.ai.*;
import com.groupmart.dto.product.ProductDto;
import com.groupmart.entity.Product;
import com.groupmart.repository.ProductRepository;
import com.groupmart.service.AiVisionSearchService;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AiVisionSearchServiceImpl implements AiVisionSearchService {

    private final ProductRepository productRepository;

    @Override
    @Transactional(readOnly = true)
    public List<ProductDto> searchByImage(ImageSearchRequest request) {
        String ocr = request.getExtractedOcrText() != null ? request.getExtractedOcrText().toLowerCase() : "";
        List<Product> catalog = productRepository.findAll();

        List<Product> matches = catalog.stream()
                .filter(Product::isActive)
                .filter(p -> {
                    if (!ocr.isEmpty()) {
                        return p.getName().toLowerCase().contains(ocr) ||
                               (p.getCategory() != null && p.getCategory().getName().toLowerCase().contains(ocr)) ||
                               p.getDescription().toLowerCase().contains(ocr);
                    }
                    return true;
                })
                .sorted(Comparator.comparing(Product::getRating).reversed())
                .limit(6)
                .collect(Collectors.toList());

        if (matches.isEmpty()) {
            matches = catalog.stream()
                    .filter(Product::isActive)
                    .filter(Product::isFeatured)
                    .limit(4)
                    .collect(Collectors.toList());
        }

        return matches.stream().map(this::mapToDto).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ProductComparisonResponse compareProducts(ProductComparisonRequest request) {
        Product p1 = productRepository.findById(request.getProductId1())
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", request.getProductId1()));
        Product p2 = productRepository.findById(request.getProductId2())
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", request.getProductId2()));

        ProductDto dto1 = mapToDto(p1);
        ProductDto dto2 = mapToDto(p2);

        Map<String, String> matrix = new LinkedHashMap<>();
        matrix.put("Price", String.format("$%s vs $%s", p1.getPrice(), p2.getPrice()));
        matrix.put("Rating", String.format("%.1f ★ vs %.1f ★", p1.getRating(), p2.getRating()));
        matrix.put("Reviews Count", String.format("%d reviews vs %d reviews", p1.getReviewCount(), p2.getReviewCount()));
        matrix.put("Stock Availability", String.format("%d in stock vs %d in stock", p1.getStockQuantity(), p2.getStockQuantity()));
        matrix.put("Category", String.format("%s vs %s",
                p1.getCategory() != null ? p1.getCategory().getName() : "N/A",
                p2.getCategory() != null ? p2.getCategory().getName() : "N/A"));

        String winnerId = p1.getRating() >= p2.getRating() ? p1.getId().toString() : p2.getId().toString();
        String summary = String.format("AI Evaluation: %s leads with a higher average rating of %.1f stars and %d customer reviews.",
                p1.getRating() >= p2.getRating() ? p1.getName() : p2.getName(),
                Math.max(p1.getRating(), p2.getRating()),
                p1.getRating() >= p2.getRating() ? p1.getReviewCount() : p2.getReviewCount());

        List<String> p1Pros = List.of(
                "Rating: " + p1.getRating() + " stars",
                "Price: $" + p1.getPrice(),
                "Stock: " + p1.getStockQuantity() + " units available"
        );

        List<String> p2Pros = List.of(
                "Rating: " + p2.getRating() + " stars",
                "Price: $" + p2.getPrice(),
                "Stock: " + p2.getStockQuantity() + " units available"
        );

        return ProductComparisonResponse.builder()
                .product1(dto1)
                .product2(dto2)
                .winnerProductId(winnerId)
                .aiSummaryRecommendation(summary)
                .specComparisonMatrix(matrix)
                .product1Pros(p1Pros)
                .product2Pros(p2Pros)
                .build();
    }

    @Override
    public List<String> getTrendingSearchKeywords() {
        return List.of(
                "Gaming Laptops",
                "Noise Canceling Headphones",
                "Flagship Cameras",
                "4K Workstations",
                "Wireless Earbuds",
                "Mechanical Keyboards"
        );
    }

    @Override
    public SearchAnalyticsDto getSearchAnalytics() {
        List<Map<String, Object>> trending = List.of(
                Map.of("keyword", "Gaming Laptops", "count", 1420),
                Map.of("keyword", "Studio Headphones", "count", 980),
                Map.of("keyword", "Wireless Cameras", "count", 760),
                Map.of("keyword", "Ultrabooks", "count", 640)
        );

        List<Map<String, Object>> categories = List.of(
                Map.of("category", "Electronics", "percentage", 48.5),
                Map.of("category", "Computers", "percentage", 32.0),
                Map.of("category", "Audio", "percentage", 19.5)
        );

        return SearchAnalyticsDto.builder()
                .totalSearchesToday(3800)
                .topTrendingKeywords(trending)
                .popularCategories(categories)
                .build();
    }

    private ProductDto mapToDto(Product p) {
        String catName = p.getCategory() != null ? p.getCategory().getName() : "General";
        String catSlug = p.getCategory() != null ? p.getCategory().getSlug() : "general";
        String storeName = p.getSellerStore() != null ? p.getSellerStore().getStoreName() : "Nexus Marketplace";
        String storeSlug = p.getSellerStore() != null ? p.getSellerStore().getStoreName().toLowerCase().replace(" ", "-") : "nexus";

        return ProductDto.builder()
                .id(p.getId())
                .name(p.getName())
                .sku(p.getSku())
                .slug(p.getSlug())
                .description(p.getDescription())
                .price(p.getPrice())
                .compareAtPrice(p.getCompareAtPrice())
                .categoryId(p.getCategory() != null ? p.getCategory().getId() : null)
                .categoryName(catName)
                .categorySlug(catSlug)
                .sellerStoreId(p.getSellerStore() != null ? p.getSellerStore().getId() : null)
                .sellerStoreName(storeName)
                .sellerStoreSlug(storeSlug)
                .stockQuantity(p.getStockQuantity())
                .imageUrls(p.getImageUrls())
                .rating(p.getRating())
                .reviewCount(p.getReviewCount())
                .featured(p.isFeatured())
                .active(p.isActive())
                .createdAt(p.getCreatedAt())
                .build();
    }
}
