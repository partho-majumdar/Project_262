package com.groupmart.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.product.ProductDto;
import com.groupmart.dto.search.SearchFilterRequest;
import com.groupmart.dto.search.SearchResultDto;
import com.groupmart.service.SearchService;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/v1/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    @GetMapping
    public ResponseEntity<ApiResponse<SearchResultDto>> searchProducts(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String categorySlug,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) Double minRating,
            @RequestParam(required = false) Boolean inStock,
            @RequestParam(required = false, defaultValue = "newest") String sortBy,
            @RequestParam(required = false, defaultValue = "0") Integer page,
            @RequestParam(required = false, defaultValue = "24") Integer size
    ) {
        String finalQuery = (q != null && !q.trim().isEmpty()) ? q : query;
        String finalCategory = (categorySlug != null && !categorySlug.trim().isEmpty()) ? categorySlug : category;

        SearchFilterRequest request = SearchFilterRequest.builder()
                .query(finalQuery)
                .categorySlug(finalCategory)
                .minPrice(minPrice)
                .maxPrice(maxPrice)
                .minRating(minRating)
                .inStockOnly(inStock)
                .sortBy(sortBy)
                .page(page)
                .size(size)
                .build();

        SearchResultDto result = searchService.searchProducts(request);
        return ResponseEntity.ok(ApiResponse.success("Search results retrieved", result));
    }

    @GetMapping("/suggestions")
    public ResponseEntity<ApiResponse<List<ProductDto>>> getSearchSuggestions(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String query
    ) {
        String searchTerm = (q != null && !q.trim().isEmpty()) ? q : query;
        List<ProductDto> suggestions = searchService.getSearchSuggestions(searchTerm);
        return ResponseEntity.ok(ApiResponse.success("Search suggestions retrieved", suggestions));
    }
}
