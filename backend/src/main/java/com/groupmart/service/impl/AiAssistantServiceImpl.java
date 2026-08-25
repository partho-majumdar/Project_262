package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.dto.ai.AiAssistantRequest;
import com.groupmart.dto.ai.AiAssistantResponse;
import com.groupmart.dto.product.ProductDto;
import com.groupmart.entity.Order;
import com.groupmart.entity.Product;
import com.groupmart.repository.OrderRepository;
import com.groupmart.repository.ProductRepository;
import com.groupmart.service.AiAssistantService;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AiAssistantServiceImpl implements AiAssistantService {

    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;

    @Value("${openai.api.key:}")
    private String openAiApiKey;

    @Value("${openai.model:gpt-3.5-turbo}")
    private String openAiModel;

    @Override
    @Transactional(readOnly = true)
    public AiAssistantResponse processAssistantChat(AiAssistantRequest request) {
        String msg = request.getMessage() != null ? request.getMessage().trim() : "";
        String lowerMsg = msg.toLowerCase();

        // 1. Order Status Tracking Intent
        if (lowerMsg.contains("order") || lowerMsg.contains("track") || lowerMsg.contains("status") || request.getOrderNumber() != null) {
            return processOrderStatusQuery(request, lowerMsg);
        }

        // 2. Shipping & Delivery Policy Intent
        if (lowerMsg.contains("shipping") || lowerMsg.contains("delivery") || lowerMsg.contains("courier") || lowerMsg.contains("dispatch")) {
            return AiAssistantResponse.builder()
                    .intent("SHIPPING_POLICY")
                    .reply("Standard ground shipping takes 3-5 business days ($5.99, FREE for orders over $50). Priority Express takes 1-2 business days ($14.99), and Overnight Courier delivers next business day ($29.99). All orders include real-time tracking numbers!")
                    .recommendedProducts(List.of())
                    .suggestedPrompts(List.of("Track my recent order", "What is your return policy?", "Show gaming laptops"))
                    .timestamp(LocalDateTime.now())
                    .build();
        }

        // 3. Return & Refund Policy Intent
        if (lowerMsg.contains("return") || lowerMsg.contains("refund") || lowerMsg.contains("exchange") || lowerMsg.contains("money back")) {
            return AiAssistantResponse.builder()
                    .intent("RETURN_REFUND_POLICY")
                    .reply("We offer a hassle-free 30-day return policy! Items must be unused in original packaging. Once inspected, refunds are processed to your original payment method (Stripe/PayPal) within 2-3 business days.")
                    .recommendedProducts(List.of())
                    .suggestedPrompts(List.of("How do I contact support?", "What payment methods are accepted?", "Suggest electronics under $1000"))
                    .timestamp(LocalDateTime.now())
                    .build();
        }

        // 4. Payment Methods Intent
        if (lowerMsg.contains("payment") || lowerMsg.contains("card") || lowerMsg.contains("paypal") || lowerMsg.contains("cod") || lowerMsg.contains("stripe")) {
            return AiAssistantResponse.builder()
                    .intent("PAYMENT_METHODS")
            .reply("GroupMart AI supports Credit/Debit Cards (Visa, MasterCard, Amex via Stripe), PayPal One-Touch, and Cash on Delivery (COD) for eligible regional zip codes. All online transactions are 256-bit SSL encrypted.")
            .recommendedProducts(List.of())
            .suggestedPrompts(List.of("Show active promo coupons", "What is the shipping policy?", "Recommend smart audio devices"))
            .timestamp(LocalDateTime.now())
            .build();
        }

        // 5. Product Recommendation / Shopping Intent (Budget, Laptop, Gaming, Photography, Comparison)
        List<Product> catalog = productRepository.findAll();
        List<Product> matchingProducts = new ArrayList<>();

        if (lowerMsg.contains("laptop") || lowerMsg.contains("macbook") || lowerMsg.contains("gaming") || lowerMsg.contains("computer")) {
            matchingProducts = catalog.stream()
                    .filter(p -> p.isActive() && (p.getName().toLowerCase().contains("laptop") || p.getName().toLowerCase().contains("book") || p.getName().toLowerCase().contains("pro")))
                    .collect(Collectors.toList());
        } else if (lowerMsg.contains("audio") || lowerMsg.contains("headphone") || lowerMsg.contains("earbud") || lowerMsg.contains("sound") || lowerMsg.contains("speaker")) {
            matchingProducts = catalog.stream()
                    .filter(p -> p.isActive() && (p.getName().toLowerCase().contains("audio") || p.getName().toLowerCase().contains("headphone") || p.getName().toLowerCase().contains("bud") || p.getName().toLowerCase().contains("noise")))
                    .collect(Collectors.toList());
        } else if (lowerMsg.contains("phone") || lowerMsg.contains("camera") || lowerMsg.contains("photo") || lowerMsg.contains("mobile")) {
            matchingProducts = catalog.stream()
                    .filter(p -> p.isActive() && (p.getName().toLowerCase().contains("phone") || p.getName().toLowerCase().contains("camera") || p.getName().toLowerCase().contains("pixel") || p.getName().toLowerCase().contains("ultra")))
                    .collect(Collectors.toList());
        } else {
            matchingProducts = catalog.stream()
                    .filter(Product::isActive)
                    .sorted(Comparator.comparing(Product::getRating).reversed())
                    .limit(4)
                    .collect(Collectors.toList());
        }

        // Budget filtering if specified
        if (request.getMaxBudget() != null && request.getMaxBudget() > 0) {
            double budget = request.getMaxBudget();
            matchingProducts = matchingProducts.stream()
                    .filter(p -> p.getPrice().doubleValue() <= budget)
                    .collect(Collectors.toList());
        }

        List<ProductDto> recDtos = matchingProducts.stream()
                .limit(4)
                .map(this::mapToDto)
                .collect(Collectors.toList());

        String responseReply = "Here are the top intelligent recommendations curated from our live inventory matching your query:";
        if (lowerMsg.contains("laptop")) {
            responseReply = "Based on performance vector benchmarks and user reviews, here are our recommended high-performance laptops:";
        } else if (lowerMsg.contains("audio") || lowerMsg.contains("headphone")) {
            responseReply = "Here are our top noise-canceling audio gear and studio headphone recommendations:";
        } else if (lowerMsg.contains("phone") || lowerMsg.contains("camera")) {
            responseReply = "Here are our top mobile devices and photography flagship recommendations:";
        }

        return AiAssistantResponse.builder()
                .intent("PRODUCT_RECOMMENDATION")
                .reply(responseReply)
                .recommendedProducts(recDtos)
                .suggestedPrompts(List.of("Show products under $500", "What is the return policy?", "Track my order"))
                .timestamp(LocalDateTime.now())
                .build();
    }

    private AiAssistantResponse processOrderStatusQuery(AiAssistantRequest request, String lowerMsg) {
        String orderNum = request.getOrderNumber();
        if (orderNum == null || orderNum.trim().isEmpty()) {
            // Extract from message if formatted as ORD-...
            for (String word : lowerMsg.split("\\s+")) {
                if (word.toUpperCase().startsWith("ORD-")) {
                    orderNum = word.toUpperCase();
                    break;
                }
            }
        }

        if (orderNum != null && !orderNum.trim().isEmpty()) {
            Optional<Order> orderOpt = orderRepository.findByOrderNumber(orderNum);
            if (orderOpt.isPresent()) {
                Order order = orderOpt.get();
                return AiAssistantResponse.builder()
                        .intent("ORDER_STATUS")
                        .reply(String.format("Order #%s status is currently %s. Payment Status: %s. Total Amount: $%s. Placed on %s.",
                                order.getOrderNumber(), order.getStatus(), order.getPaymentStatus(), order.getTotalAmount(),
                                order.getCreatedAt() != null ? order.getCreatedAt().toString().substring(0, 10) : "Recently"))
                        .recommendedProducts(List.of())
                        .suggestedPrompts(List.of("Track another order", "What is your shipping policy?", "Suggest laptops"))
                        .timestamp(LocalDateTime.now())
                        .build();
            }
        }

        return AiAssistantResponse.builder()
                .intent("ORDER_STATUS_PROMPT")
                .reply("To track your order status, please provide your Order Number (e.g. ORD-20260726-8849) or check your Orders History in your Customer Account Dashboard.")
                .recommendedProducts(List.of())
                .suggestedPrompts(List.of("Show my recent orders", "What is the shipping policy?", "Return policy"))
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Override
    public Map<String, String> getStorePolicies() {
        Map<String, String> policies = new LinkedHashMap<>();
        policies.put("shipping", "Free Standard Shipping on orders over $50 (3-5 business days). Priority Express ($14.99, 1-2 days), Overnight Courier ($29.99, next day).");
        policies.put("return", "30-day hassle-free return window for unused items in original packaging. Full refunds issued to original payment method.");
        policies.put("payment", "We accept Credit/Debit Cards (Visa, MasterCard, Amex via Stripe), PayPal, and Cash on Delivery (COD).");
        policies.put("warranty", "All products include a 1-year manufacturer warranty against hardware defects.");
        return policies;
    }

    @Override
    public List<Map<String, String>> getFaqs() {
        List<Map<String, String>> faqs = new ArrayList<>();
        faqs.add(Map.of("question", "How long does shipping take?", "answer", "Standard shipping takes 3-5 business days. Priority express takes 1-2 days."));
        faqs.add(Map.of("question", "How do I return a product?", "answer", "Initiate a return from your Account Orders page within 30 days of delivery."));
        faqs.add(Map.of("question", "Are promo coupons stackable?", "answer", "One promotional coupon can be applied per checkout order."));
        return faqs;
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
