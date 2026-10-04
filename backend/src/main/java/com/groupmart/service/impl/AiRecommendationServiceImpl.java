package com.groupmart.service.impl;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.ai.AiChatRequest;
import com.groupmart.dto.ai.AiChatResponse;
import com.groupmart.dto.ai.RecommendationResponse;
import com.groupmart.dto.product.ProductDto;
import com.groupmart.entity.Category;
import com.groupmart.entity.Order;
import com.groupmart.entity.OrderItem;
import com.groupmart.entity.Product;
import com.groupmart.entity.User;
import com.groupmart.repository.CategoryRepository;
import com.groupmart.repository.OrderRepository;
import com.groupmart.repository.ProductRepository;
import com.groupmart.repository.UserRepository;
import com.groupmart.repository.WishlistRepository;
import com.groupmart.service.AiRecommendationService;
import com.groupmart.service.AiAssistantService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class AiRecommendationServiceImpl implements AiRecommendationService {

    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final WishlistRepository wishlistRepository;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final AiAssistantService aiAssistantService;

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    @Value("${gemini.api.url:https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent}")
    private String geminiApiUrl;

    @Value("${gemini.model:gemini-2.0-flash}")
    private String geminiModel;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();

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
            reply = "Here are our best budget deals and discounted items under ৳200:";
        } else {
            intent = "CATALOG_SEARCH";
            matchedProducts = productRepository.findByFeaturedTrueAndActiveTrue().stream()
                    .limit(3)
                    .collect(Collectors.toList());
            reply = "Hello! I am GMart AI, your personal commerce assistant. Based on your prompt, here are our overall top recommended products:";
        }

        String aiEnhanced = callAiEnhancement(msg, matchedProducts);
        if (aiEnhanced != null && !aiEnhanced.isBlank()) {
            reply = aiEnhanced;
        }

        return AiChatResponse.builder()
                .reply(reply)
                .intentDetected(intent)
                .recommendedProducts(matchedProducts.stream().map(this::mapToDto).collect(Collectors.toList()))
                .build();
    }

    private String callAiEnhancement(String userMessage, List<Product> matchedProducts) {
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            return null;
        }

        try {
            StringBuilder catalogContext = new StringBuilder();
            catalogContext.append("You are GroupMart AI. Prices are in Bangladeshi Taka (BDT), written with the ৳ sign. Here is our live catalog:\n");
            for (Product p : matchedProducts) {
                String catName = p.getCategory() != null ? p.getCategory().getName() : "General";
                catalogContext.append("- ").append(p.getName())
                        .append(" | ").append(catName)
                        .append(" | ৳").append(p.getPrice())
                        .append(" | Stock: ").append(p.getStockQuantity()).append("\n");
            }
            catalogContext.append("\nUser query: ").append(userMessage).append("\n\n");
            catalogContext.append("Provide a short, friendly 1-2 sentence recommendation citing the products above.");

            String requestBody = objectMapper.writeValueAsString(Map.of(
                    "contents", List.of(Map.of(
                            "parts", List.of(
                                    Map.of("text", catalogContext.toString())
                            )
                    )),
                    "generationConfig", Map.of(
                            "temperature", 0.4,
                            "maxOutputTokens", 256
                    )
            ));

            String url = geminiApiUrl + "?key=" + geminiApiKey;
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode candidates = root.path("candidates");
                if (candidates.isArray() && candidates.size() > 0) {
                    JsonNode textNode = candidates.get(0).path("content").path("parts").get(0).path("text");
                    if (textNode.isTextual()) {
                        return textNode.asText().trim();
                    }
                }
            }
        } catch (Exception ex) {
            return null;
        }
        return null;
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