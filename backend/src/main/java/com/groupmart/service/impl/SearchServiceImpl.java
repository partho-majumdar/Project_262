package com.groupmart.service.impl;

import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.dto.product.ProductDto;
import com.groupmart.dto.search.SearchFilterRequest;
import com.groupmart.dto.search.SearchResultDto;
import com.groupmart.entity.Product;
import com.groupmart.repository.ProductRepository;
import com.groupmart.service.SearchService;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SearchServiceImpl implements SearchService {

    private final ProductRepository productRepository;

    // Intelligent Synonym & Intent Dictionary (Amazon / Flipkart Style)
    private static final Map<String, List<String>> SYNONYM_MAP = new HashMap<>();

    static {
        SYNONYM_MAP.put("shoes", List.of("shoes", "sneakers", "running", "footwear", "nike", "adidas", "puma", "air max", "pulse", "woodland"));
        SYNONYM_MAP.put("sneakers", List.of("shoes", "sneakers", "footwear", "running", "nike", "adidas", "puma"));
        SYNONYM_MAP.put("footwear", List.of("shoes", "sneakers", "footwear", "running"));
        SYNONYM_MAP.put("laptop", List.of("laptop", "macbook", "notebook", "computer", "workstation", "dell", "hp", "lenovo", "asus", "xps", "strix", "nexusbook"));
        SYNONYM_MAP.put("laptops", List.of("laptop", "macbook", "notebook", "computer", "workstation", "dell", "hp", "lenovo", "asus"));
        SYNONYM_MAP.put("macbook", List.of("macbook", "laptop", "apple", "nexusbook"));
        SYNONYM_MAP.put("phone", List.of("phone", "mobile", "smartphone", "iphone", "samsung", "galaxy", "oneplus", "nothing", "pixel"));
        SYNONYM_MAP.put("phones", List.of("phone", "mobile", "smartphone", "iphone", "samsung", "oneplus"));
        SYNONYM_MAP.put("mobile", List.of("phone", "mobile", "smartphone", "iphone", "samsung", "oneplus"));
        SYNONYM_MAP.put("mobiles", List.of("phone", "mobile", "smartphone", "iphone", "samsung", "oneplus"));
        SYNONYM_MAP.put("iphone", List.of("iphone", "apple", "phone", "mobile", "titanium"));
        SYNONYM_MAP.put("samsung", List.of("samsung", "galaxy", "phone", "mobile", "ultra"));
        SYNONYM_MAP.put("nike", List.of("nike", "shoes", "sneakers", "air max", "pulse"));
        SYNONYM_MAP.put("adidas", List.of("adidas", "shoes", "sneakers", "ultraboost"));
        SYNONYM_MAP.put("puma", List.of("puma", "shoes", "sneakers", "speedcat"));
        SYNONYM_MAP.put("headphones", List.of("headphones", "headset", "earphones", "audio", "sound", "sony", "jbl", "bose", "wh-1000xm5"));
        SYNONYM_MAP.put("headphone", List.of("headphones", "headset", "earphones", "audio", "sound", "sony", "jbl", "bose"));
        SYNONYM_MAP.put("earphones", List.of("headphones", "earphones", "audio", "sound"));
        SYNONYM_MAP.put("watch", List.of("watch", "smartwatch", "wearable", "apple watch", "ultra 2"));
        SYNONYM_MAP.put("watches", List.of("watch", "smartwatch", "wearable", "apple watch"));
        SYNONYM_MAP.put("camera", List.of("camera", "photography", "sony alpha", "canon", "eos", "drone", "dji", "mavic"));
        SYNONYM_MAP.put("cameras", List.of("camera", "photography", "sony alpha", "canon"));
    }

    @Override
    @Transactional(readOnly = true)
    public SearchResultDto searchProducts(SearchFilterRequest request) {
        int pageNumber = request.getPage() != null ? request.getPage() : 0;
        int pageSize = request.getSize() != null ? request.getSize() : 24;

        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt");
        if ("price_asc".equalsIgnoreCase(request.getSortBy())) {
            sort = Sort.by(Sort.Direction.ASC, "price");
        } else if ("price_desc".equalsIgnoreCase(request.getSortBy())) {
            sort = Sort.by(Sort.Direction.DESC, "price");
        } else if ("rating".equalsIgnoreCase(request.getSortBy()) || "rating_desc".equalsIgnoreCase(request.getSortBy())) {
            sort = Sort.by(Sort.Direction.DESC, "rating");
        }

        Pageable pageable = PageRequest.of(pageNumber, pageSize, sort);

        // Process search query terms and expand synonyms
        String rawQuery = request.getQuery() != null ? request.getQuery().trim().toLowerCase() : "";
        Set<String> searchTerms = expandSearchTerms(rawQuery);

        Specification<Product> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Active products only
            predicates.add(cb.equal(root.get("active"), true));

            // Multi-field Intelligent Search (Name, Category, Brand, Description, SKU)
            if (!searchTerms.isEmpty()) {
                List<Predicate> termPredicates = new ArrayList<>();

                for (String term : searchTerms) {
                    String likePattern = "%" + term + "%";

                    Predicate nameMatch = cb.like(cb.lower(root.get("name")), likePattern);
                    Predicate descMatch = cb.like(cb.lower(root.get("description")), likePattern);
                    Predicate skuMatch = cb.like(cb.lower(root.get("sku")), likePattern);
                    Predicate categoryMatch = cb.like(cb.lower(root.get("category").get("name")), likePattern);
                    Predicate categorySlugMatch = cb.like(cb.lower(root.get("category").get("slug")), likePattern);

                    termPredicates.add(cb.or(nameMatch, descMatch, skuMatch, categoryMatch, categorySlugMatch));
                }

                predicates.add(cb.or(termPredicates.toArray(new Predicate[0])));
            }

            // Category Filter (if specified and not conflicting)
            if (request.getCategorySlug() != null && !request.getCategorySlug().trim().isEmpty()) {
                predicates.add(cb.equal(root.get("category").get("slug"), request.getCategorySlug().trim()));
            }

            // Price Range Boundaries
            if (request.getMinPrice() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("price"), request.getMinPrice()));
            }
            if (request.getMaxPrice() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("price"), request.getMaxPrice()));
            }

            // Star Rating Threshold
            if (request.getMinRating() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("rating"), request.getMinRating()));
            }

            // In-Stock Only
            if (Boolean.TRUE.equals(request.getInStockOnly())) {
                predicates.add(cb.greaterThan(root.get("stockQuantity"), 0));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<Product> productPage = productRepository.findAll(spec, pageable);

        // Rank results by relevance (Exact name matches first)
        List<Product> content = new ArrayList<>(productPage.getContent());
        if (!rawQuery.isEmpty()) {
            content.sort(Comparator.comparing((Product p) -> p.getName().toLowerCase().contains(rawQuery) ? 0 : 1));
        }

        List<ProductDto> dtos = content.stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());

        return SearchResultDto.builder()
                .content(dtos)
                .page(productPage.getNumber())
                .size(productPage.getSize())
                .totalElements(productPage.getTotalElements())
                .totalPages(productPage.getTotalPages())
                .priceRangeMin(new BigDecimal("0.00"))
                .priceRangeMax(new BigDecimal("5000.00"))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductDto> getSearchSuggestions(String query) {
        if (query == null || query.trim().length() < 2) {
            return Collections.emptyList();
        }

        String search = query.trim().toLowerCase();
        List<Product> products = productRepository.findAll();

        return products.stream()
                .filter(p -> p.isActive() && (
                        p.getName().toLowerCase().contains(search) ||
                        (p.getCategory() != null && p.getCategory().getName().toLowerCase().contains(search))
                ))
                .limit(5)
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    private Set<String> expandSearchTerms(String rawQuery) {
        if (rawQuery == null || rawQuery.trim().isEmpty()) {
            return Collections.emptySet();
        }

        Set<String> terms = new HashSet<>();
        String[] tokens = rawQuery.split("\\s+");

        for (String token : tokens) {
            if (token.length() < 2) continue;
            terms.add(token);

            if (SYNONYM_MAP.containsKey(token)) {
                terms.addAll(SYNONYM_MAP.get(token));
            }
        }

        return terms;
    }

    private ProductDto mapToDto(Product product) {
        return ProductDto.builder()
                .id(product.getId())
                .name(product.getName())
                .sku(product.getSku())
                .slug(product.getSlug())
                .description(product.getDescription())
                .price(product.getPrice())
                .compareAtPrice(product.getCompareAtPrice())
                .categoryId(product.getCategory() != null ? product.getCategory().getId() : null)
                .categoryName(product.getCategory() != null ? product.getCategory().getName() : null)
                .categorySlug(product.getCategory() != null ? product.getCategory().getSlug() : null)
                .sellerStoreId(product.getSellerStore() != null ? product.getSellerStore().getId() : null)
                .sellerStoreName(product.getSellerStore() != null ? product.getSellerStore().getStoreName() : "GroupMart Official Store")
                .sellerStoreSlug(product.getSellerStore() != null ? product.getSellerStore().getStoreSlug() : null)
                .stockQuantity(product.getStockQuantity())
                .imageUrls(product.getImageUrls())
                .rating(product.getRating())
                .reviewCount(product.getReviewCount())
                .featured(product.isFeatured())
                .active(product.isActive())
                .createdAt(product.getCreatedAt())
                .build();
    }
}
