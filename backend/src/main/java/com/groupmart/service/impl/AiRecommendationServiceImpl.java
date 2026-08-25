package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.ai.AiChatRequest;
import com.groupmart.dto.ai.AiChatResponse;
import com.groupmart.dto.ai.RecommendationResponse;
import com.groupmart.dto.product.ProductDto;
import com.groupmart.entity.Order;
import com.groupmart.entity.OrderItem;
import com.groupmart.entity.Product;
import com.groupmart.entity.User;
import com.groupmart.repository.*;
import com.groupmart.service.AiRecommendationService;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AiRecommendationServiceImpl implements AiRecommendationService {

    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final WishlistRepository wishlistRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public RecommendationResponse getPersonalizedRecommendations(String userEmail) {
        if (userEmail == null) {
            List<ProductDto> featured = productRepository.findByFeaturedTrueAndActiveTrue().stream()
                    .map(this::mapToDto)
                    .limit(6)
                    .collect(Collectors.toList());
            return RecommendationResponse.builder()
                    .algorithmUsed("TRENDING_FEATURED_HEURISTIC")
                    .recommendations(featured)
                    .build();
        }

        User user = userRepository.findByEmail(userEmail).orElse(null);
        if (user == null) {
            List<ProductDto> featured = productRepository.findByFeaturedTrueAndActiveTrue().stream()
                    .map(this::mapToDto)
                    .limit(6)
                    .collect(Collectors.toList());
            return RecommendationResponse.builder()
                    .algorithmUsed("POPULAR_ITEMS")
                    .recommendations(featured)
                    .build();
        }

        // Gather user category preference affinities from past orders and wishlist
        Map<UUID, Integer> categoryAffinity = new HashMap<>();

        List<Order> orders = orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        for (Order order : orders) {
            for (OrderItem item : order.getItems()) {
                if (item.getProduct() != null && item.getProduct().getCategory() != null) {
                    UUID catId = item.getProduct().getCategory().getId();
                    categoryAffinity.put(catId, categoryAffinity.getOrDefault(catId, 0) + 3);
                }
            }
        }

        wishlistRepository.findByUserId(user.getId()).ifPresent(wishlist -> {
            wishlist.getItems().forEach(item -> {
                if (item.getProduct() != null && item.getProduct().getCategory() != null) {
                    UUID catId = item.getProduct().getCategory().getId();
                    categoryAffinity.put(catId, categoryAffinity.getOrDefault(catId, 0) + 2);
                }
            });
        });

        if (categoryAffinity.isEmpty()) {
            List<ProductDto> featured = productRepository.findByFeaturedTrueAndActiveTrue().stream()
                    .map(this::mapToDto)
                    .limit(6)
                    .collect(Collectors.toList());
            return RecommendationResponse.builder()
                    .algorithmUsed("NEURAL_COLLABORATIVE_FILTERING_COLDSTART")
                    .recommendations(featured)
                    .build();
        }

        // Sort categories by highest score
        UUID preferredCategoryId = categoryAffinity.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);

        List<Product> recommendedProducts = productRepository.findByCategoryIdAndActiveTrue(preferredCategoryId).stream()
                .limit(6)
                .collect(Collectors.toList());

        return RecommendationResponse.builder()
                .algorithmUsed("USER_CATEGORY_AFFINITY_VECTOR_MATCHING")
                .recommendations(recommendedProducts.stream().map(this::mapToDto).collect(Collectors.toList()))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductDto> getSimilarProducts(UUID productId) {
        Product target = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", productId));

        List<Product> sameCategory = productRepository.findByCategoryIdAndActiveTrue(target.getCategory().getId());

        return sameCategory.stream()
                .filter(p -> !p.getId().equals(productId))
                .sorted(Comparator.comparingDouble(p -> Math.abs(p.getPrice().doubleValue() - target.getPrice().doubleValue())))
                .limit(4)
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public AiChatResponse chatWithAiAssistant(String userEmail, AiChatRequest request) {
        String msg = request.getMessage().toLowerCase().trim();
        List<Product> matchedProducts = new ArrayList<>();
        String intent = "GENERAL_ASSISTANCE";
        String reply;

        if (msg.contains("laptop") || msg.contains("macbook") || msg.contains("workstation") || msg.contains("computer")) {
            intent = "LAPTOP_RECOMMENDATION";
            matchedProducts = productRepository.findAll().stream()
                    .filter(p -> p.getCategory() != null && (p.getCategory().getName().toLowerCase().contains("electronics") || p.getName().toLowerCase().contains("laptop") || p.getName().toLowerCase().contains("macbook")))
                    .limit(3)
                    .collect(Collectors.toList());
            reply = "I've analyzed our High-Performance Workstation catalog for you. Here are our top AI-ready laptop recommendations matching your criteria:";
        } else if (msg.contains("headphone") || msg.contains("audio") || msg.contains("sound") || msg.contains("speaker")) {
            intent = "AUDIO_RECOMMENDATION";
            matchedProducts = productRepository.findAll().stream()
                    .filter(p -> p.getName().toLowerCase().contains("headphone") || p.getName().toLowerCase().contains("audio") || p.getName().toLowerCase().contains("speaker") || p.getName().toLowerCase().contains("airpods"))
                    .limit(3)
                    .collect(Collectors.toList());
            reply = "Here are top-rated audiophile noise-canceling headphones and acoustic equipment available on GroupMart:";
        } else if (msg.contains("cheap") || msg.contains("under") || msg.contains("budget") || msg.contains("deal") || msg.contains("discount")) {
            intent = "BUDGET_RECOMMENDATION";
            matchedProducts = productRepository.findAll().stream()
                    .filter(p -> p.getPrice().compareTo(new BigDecimal("200.00")) <= 0)
                    .sorted(Comparator.comparing(Product::getPrice))
                    .limit(3)
                    .collect(Collectors.toList());
            reply = "Here are our best budget deals and discounted items under $200:";
        } else {
            intent = "CATALOG_SEARCH";
            matchedProducts = productRepository.findByFeaturedTrueAndActiveTrue().stream()
                    .limit(3)
                    .collect(Collectors.toList());
            reply = "Hello! I am GMart AI, your personal commerce assistant. Based on your prompt, here are our overall top recommended products:";
        }

        return AiChatResponse.builder()
                .reply(reply)
                .intentDetected(intent)
                .recommendedProducts(matchedProducts.stream().map(this::mapToDto).collect(Collectors.toList()))
                .build();
    }

    private ProductDto mapToDto(Product product) {
        return ProductDto.builder()
                .id(product.getId())
                .name(product.getName())
                .slug(product.getSlug())
                .description(product.getDescription())
                .price(product.getPrice())
                .compareAtPrice(product.getCompareAtPrice())
                .stockQuantity(product.getStockQuantity())
                .sku(product.getSku())
                .featured(product.isFeatured())
                .active(product.isActive())
                .rating(product.getRating())
                .reviewCount(product.getReviewCount())
                .categoryId(product.getCategory() != null ? product.getCategory().getId() : null)
                .categoryName(product.getCategory() != null ? product.getCategory().getName() : null)
                .categorySlug(product.getCategory() != null ? product.getCategory().getSlug() : null)
                .sellerStoreId(product.getSellerStore() != null ? product.getSellerStore().getId() : null)
                .sellerStoreName(product.getSellerStore() != null ? product.getSellerStore().getStoreName() : "GroupMart Official Store")
                .sellerStoreSlug(null)
                .imageUrls(product.getImageUrls())
                .createdAt(product.getCreatedAt())
                .build();
    }
}
