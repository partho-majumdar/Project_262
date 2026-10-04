package com.groupmart.service.impl;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import com.groupmart.dto.ai.AiAssistantRequest;
import com.groupmart.dto.ai.AiAssistantResponse;
import com.groupmart.dto.product.ProductDto;
import com.groupmart.entity.KnowledgeChunk;
import com.groupmart.entity.Product;
import com.groupmart.entity.SearchHistory;
import com.groupmart.entity.SearchSource;
import com.groupmart.repository.ProductRepository;
import com.groupmart.service.AiAssistantService;
import com.groupmart.service.RagRetrievalService;
import com.groupmart.service.SearchHistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fully self-built RAG shopping assistant: retrieval is the in-process TF-IDF index
 * ({@link RagRetrievalService}) and generation is rule-based composition over the
 * retrieved products/knowledge — no external embedding or LLM API is called anywhere
 * in this flow.
 */
@Service
@RequiredArgsConstructor
public class AiAssistantServiceImpl implements AiAssistantService {

    private final ProductRepository productRepository;
    private final RagRetrievalService ragRetrievalService;
    private final SearchHistoryService searchHistoryService;
    private final OrderQuestionResponder orderQuestionResponder;

    // Recognizes natural-language price ceilings/floors so a query like "under 1000 taka",
    // "greater than ৳500" or "between 300 and 800" can actually filter the catalog, instead
    // of being treated as ordinary (and unmatchable) search text.
    private static final String AMOUNT = "(?:tk\\.?|taka|bdt)?\\s*৳?\\s*(\\d[\\d,]*(?:\\.\\d+)?)";
    private static final Pattern PRICE_UNDER = Pattern.compile(
            "(?:under|below|less\\s+th(?:a|e)n|lower\\s+th(?:a|e)n|cheaper\\s+th(?:a|e)n|"
                    + "no(?:t)?\\s+more\\s+th(?:a|e)n|at\\s+most|up\\s+to|max(?:imum)?(?:\\s+of)?)\\s*" + AMOUNT,
            Pattern.CASE_INSENSITIVE);
    private static final Pattern PRICE_OVER = Pattern.compile(
            "(?:(?<!no )(?<!not )more\\s+th(?:a|e)n|greater\\s+th(?:a|e)n|higher\\s+th(?:a|e)n|bigger\\s+th(?:a|e)n|"
                    + "over|above|at\\s+least|starting\\s+(?:from|at)|min(?:imum)?(?:\\s+of)?)\\s*" + AMOUNT,
            Pattern.CASE_INSENSITIVE);
    private static final Pattern PRICE_BETWEEN = Pattern.compile(
            "(?:between|from)\\s*৳?\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:and|-|to)\\s*৳?\\s*(\\d[\\d,]*(?:\\.\\d+)?)",
            Pattern.CASE_INSENSITIVE);

    // "return within 30 days" / "up to 5 business days" are not price constraints, so a
    // number followed by one of these units is ignored rather than filtering the catalog.
    private static final Pattern NON_PRICE_UNIT = Pattern.compile(
            "\\s*(?:day|hour|week|month|year|business|working|percent|star|review|item|piece|unit|pc|gb|tb|mp|inch|kg|g|ml|l)s?\\b",
            Pattern.CASE_INSENSITIVE);

    // A "how does X work" style question gets a numbered walkthrough when the retrieved
    // knowledge chunk carries steps, rather than a single dense paragraph.
    private static final Pattern HOW_TO_INTENT = Pattern.compile(
            "\\bhow\\b|\\bstep|\\bguide\\b|\\binstruction|\\bexplain\\b|\\btutorial\\b|\\bprocess\\b|\\bwalk\\s*me\\b",
            Pattern.CASE_INSENSITIVE);

    private record PriceRange(BigDecimal min, BigDecimal max) {
        static final PriceRange NONE = new PriceRange(null, null);

        boolean isEmpty() {
            return min == null && max == null;
        }
    }

    // A plain product-discovery query ("suggest laptops") wants a short set of top picks;
    // an explicit price constraint ("under ৳1000") reads as a listing request, so it gets
    // the same page size as the regular catalog search instead of being capped to 4.
    private static final int DEFAULT_PRODUCT_LIMIT = 4;
    private static final int PRICE_QUERY_PRODUCT_LIMIT = 24;

    @Override
    @Transactional(readOnly = true)
    public AiAssistantResponse processAssistantChat(AiAssistantRequest request) {
        String msg = request.getMessage() != null ? request.getMessage().trim() : "";
        String lowerMsg = msg.toLowerCase();
        String userEmail = resolveUserEmail();

        if (!msg.isEmpty()) {
            searchHistoryService.record(userEmail, msg, SearchSource.AI_ASSISTANT);
        }

        // Questions about the customer's own orders are answered from their account data,
        // scoped to the signed-in user (see OrderQuestionResponder).
        Optional<AiAssistantResponse> orderAnswer =
                orderQuestionResponder.tryAnswer(lowerMsg, userEmail, request.getOrderNumber());
        if (orderAnswer.isPresent()) {
            return orderAnswer.get();
        }

        PriceRange priceRange = resolvePriceRange(lowerMsg, request);
        int productLimit = priceRange.isEmpty() ? DEFAULT_PRODUCT_LIMIT : PRICE_QUERY_PRODUCT_LIMIT;

        // RAG retrieval: pull only the products/knowledge actually relevant to this query
        // from the self-built TF-IDF index, instead of a fixed catalog snapshot.
        List<Product> ragProducts = ragRetrievalService.retrieveProducts(msg, productLimit);
        List<KnowledgeChunk> ragKnowledge = ragRetrievalService.retrieveKnowledge(msg, 2);
        boolean grounded = !ragProducts.isEmpty() || !ragKnowledge.isEmpty();

        // A "how does X work" question answered by a chunk that carries steps becomes a
        // numbered walkthrough, and skips the product carousel — the steps are the answer.
        boolean instructional = !ragKnowledge.isEmpty()
                && !ragKnowledge.get(0).getSteps().isEmpty()
                && HOW_TO_INTENT.matcher(lowerMsg).find();

        if (instructional) {
            return AiAssistantResponse.builder()
                    .intent("RAG_HOW_TO")
                    .reply(buildStepByStepReply(ragKnowledge.get(0)))
                    .recommendedProducts(List.of())
                    .suggestedPrompts(List.of("How do wholesale pools work?", "Track my order", "Show products under ৳1000"))
                    .timestamp(LocalDateTime.now())
                    .build();
        }

        List<Product> products = !ragProducts.isEmpty() ? ragProducts : fetchMatchingProducts(lowerMsg, productLimit);
        long totalMatchingCount = products.size();
        if (!priceRange.isEmpty()) {
            List<Product> withinBudget = filterByPrice(products, priceRange);
            if (!withinBudget.isEmpty()) {
                products = withinBudget;
                totalMatchingCount = withinBudget.size();
            } else {
                // The price constraint is authoritative: if nothing in the text-matched
                // candidates fits, fall back to a direct price-range query over the whole
                // catalog rather than silently ignoring what the customer asked for.
                var priceMatches = fetchProductsByPriceRange(priceRange, productLimit);
                products = priceMatches.getContent();
                totalMatchingCount = priceMatches.getTotalElements();
            }
        }

        List<SearchHistory> recentSearches = userEmail != null
                ? searchHistoryService.getRecentQueries(userEmail, 5).stream()
                        .filter(h -> !h.getQueryText().equalsIgnoreCase(msg))
                        .collect(Collectors.toList())
                : List.of();

        String reply = buildRagReply(msg, lowerMsg, ragKnowledge, products, recentSearches, priceRange, totalMatchingCount);

        List<ProductDto> recDtos = products.stream().map(this::mapToDto).collect(Collectors.toList());

        return AiAssistantResponse.builder()
                .intent(grounded ? "RAG_RETRIEVED" : "KEYWORD_FALLBACK")
                .reply(reply)
                .recommendedProducts(recDtos)
                .suggestedPrompts(List.of("Show products under ৳500", "What is the return policy?", "Track my order"))
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * Identity comes from the verified JWT only. The request DTO also carries a userEmail
     * field, but this endpoint is public, so trusting a caller-supplied address would let
     * anyone read someone else's order history by simply naming them.
     */
    private String resolveUserEmail() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            return auth.getName();
        }
        return null;
    }

    /**
     * Composes the reply purely from retrieved data (extractive generation): the top
     * matching knowledge chunk(s) answer policy/FAQ-style questions verbatim, a templated
     * line introduces any matching products, and recent search history lightly personalizes
     * the opener — all without calling out to any generative language model.
     */
    private String buildRagReply(String msg, String lowerMsg, List<KnowledgeChunk> knowledge, List<Product> products, List<SearchHistory> recentSearches, PriceRange priceRange, long totalMatchingCount) {
        StringBuilder reply = new StringBuilder();

        if (!knowledge.isEmpty()) {
            reply.append(knowledge.get(0).getContent());
            if (knowledge.size() > 1) {
                reply.append(" ").append(knowledge.get(1).getContent());
            }
        }

        if (!products.isEmpty()) {
            if (reply.length() > 0) {
                reply.append(" ");
            }
            if (totalMatchingCount > products.size()) {
                reply.append("Found ").append(totalMatchingCount).append(" products").append(priceRangeLabel(priceRange))
                        .append(" — showing the top ").append(products.size()).append(" from our live catalog:");
            } else {
                reply.append("Here are the matching products").append(priceRangeLabel(priceRange)).append(" from our live catalog:");
            }
        } else if (reply.length() == 0) {
            if (!priceRange.isEmpty()) {
                reply.append("I couldn't find anything").append(priceRangeLabel(priceRange)).append(" in our live catalog right now.");
            } else {
                reply.append(getFallbackReply(lowerMsg));
            }
        }

        if (!recentSearches.isEmpty() && (!knowledge.isEmpty() || !products.isEmpty())) {
            String terms = recentSearches.stream().map(SearchHistory::getQueryText).distinct().limit(3).collect(Collectors.joining(", "));
            reply.append(" (You've also recently searched for: ").append(terms).append(".)");
        }

        return reply.toString();
    }

    /** Renders a retrieved how-to chunk as a short summary followed by numbered steps. */
    private String buildStepByStepReply(KnowledgeChunk chunk) {
        StringBuilder reply = new StringBuilder(chunk.getContent());
        reply.append("\n\nHere's the step-by-step:\n");
        List<String> steps = chunk.getSteps();
        for (int i = 0; i < steps.size(); i++) {
            reply.append("\n").append(i + 1).append(". ").append(steps.get(i));
        }
        return reply.toString();
    }

    private String priceRangeLabel(PriceRange range) {
        if (range.min() != null && range.max() != null) {
            return " between ৳" + range.min() + " and ৳" + range.max();
        }
        if (range.max() != null) {
            return " under ৳" + range.max();
        }
        if (range.min() != null) {
            return " over ৳" + range.min();
        }
        return "";
    }

    /**
     * Extracts an explicit price ceiling/floor from the message text (e.g. "under 1000 taka",
     * "less then ৳500", "between 300 and 800"), falling back to the request's structured
     * {@code maxBudget} field when the text itself doesn't specify one.
     */
    private PriceRange resolvePriceRange(String lowerMsg, AiAssistantRequest request) {
        Matcher between = PRICE_BETWEEN.matcher(lowerMsg);
        while (between.find()) {
            if (isNonPriceNumber(lowerMsg, between.end())) {
                continue;
            }
            BigDecimal a = parseAmount(between.group(1));
            BigDecimal b = parseAmount(between.group(2));
            if (a != null && b != null) {
                return new PriceRange(a.min(b), a.max(b));
            }
        }

        BigDecimal max = matchAmount(PRICE_UNDER, lowerMsg);
        if (max == null && request.getMaxBudget() != null) {
            max = BigDecimal.valueOf(request.getMaxBudget());
        }
        BigDecimal min = matchAmount(PRICE_OVER, lowerMsg);

        return (min == null && max == null) ? PriceRange.NONE : new PriceRange(min, max);
    }

    private BigDecimal matchAmount(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            if (isNonPriceNumber(text, matcher.end())) {
                continue;
            }
            BigDecimal amount = parseAmount(matcher.group(1));
            if (amount != null) {
                return amount;
            }
        }
        return null;
    }

    private boolean isNonPriceNumber(String text, int matchEnd) {
        return NON_PRICE_UNIT.matcher(text.substring(matchEnd)).lookingAt();
    }

    private BigDecimal parseAmount(String raw) {
        if (raw == null) {
            return null;
        }
        try {
            return new BigDecimal(raw.replace(",", ""));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private List<Product> filterByPrice(List<Product> products, PriceRange range) {
        return products.stream()
                .filter(p -> (range.min() == null || p.getPrice().compareTo(range.min()) >= 0)
                        && (range.max() == null || p.getPrice().compareTo(range.max()) <= 0))
                .collect(Collectors.toList());
    }

    private Page<Product> fetchProductsByPriceRange(PriceRange range, int limit) {
        Double min = range.min() != null ? range.min().doubleValue() : null;
        Double max = range.max() != null ? range.max().doubleValue() : null;
        Pageable pageable = PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "rating"));
        return productRepository.filterProducts(null, null, min, max, pageable);
    }

    private List<Product> fetchMatchingProducts(String lowerMsg, int limit) {
        List<Product> catalog = productRepository.findAll();
        List<Product> matchingProducts;

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
                    .collect(Collectors.toList());
        }

        return matchingProducts.stream().limit(limit).collect(Collectors.toList());
    }

    private String getFallbackReply(String lowerMsg) {
        if (lowerMsg.contains("laptop")) {
            return "Based on our live inventory, here are our recommended high-performance laptops and workstations. Check the product recommendations below!";
        } else if (lowerMsg.contains("audio") || lowerMsg.contains("headphone")) {
            return "Here are our top noise-canceling audio gear and studio headphone recommendations from our catalog:";
        } else if (lowerMsg.contains("phone") || lowerMsg.contains("camera")) {
            return "Here are our top mobile devices and photography flagship recommendations available now:";
        } else if (lowerMsg.contains("shipping")) {
            return "Standard ground shipping takes 3-5 business days (৳5.99, FREE for orders over ৳50). Priority Express takes 1-2 business days (৳14.99), and Overnight Courier delivers next business day (৳29.99).";
        } else if (lowerMsg.contains("return") || lowerMsg.contains("refund")) {
            return "We offer a hassle-free 30-day return policy! Items must be unused in original packaging. Once inspected, refunds are processed to your original payment method within 2-3 business days.";
        } else if (lowerMsg.contains("payment")) {
            return "GroupMart AI supports Credit/Debit Cards (Visa, MasterCard, Amex via Stripe), PayPal One-Touch, and Cash on Delivery (COD) for eligible regional zip codes. All online transactions are 256-bit SSL encrypted.";
        }
        return "Hello! I am GMart AI, your personal commerce assistant. Based on your prompt, here are our overall top recommended products from our live catalog:";
    }

    @Override
    public Map<String, String> getStorePolicies() {
        Map<String, String> policies = new LinkedHashMap<>();
        policies.put("shipping", "Free Standard Shipping on orders over ৳50 (3-5 business days). Priority Express (৳14.99, 1-2 days), Overnight Courier (৳29.99, next day).");
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
