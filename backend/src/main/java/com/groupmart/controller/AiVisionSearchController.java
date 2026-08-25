package com.groupmart.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.ai.*;
import com.groupmart.dto.product.ProductDto;
import com.groupmart.service.AiVisionSearchService;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ai/vision")
@RequiredArgsConstructor
public class AiVisionSearchController {

    private final AiVisionSearchService aiVisionSearchService;

    @PostMapping("/image-search")
    public ResponseEntity<ApiResponse<List<ProductDto>>> searchByImage(@RequestBody ImageSearchRequest request) {
        List<ProductDto> products = aiVisionSearchService.searchByImage(request);
        return ResponseEntity.ok(ApiResponse.success("Visual image search matches retrieved", products));
    }

    @PostMapping("/compare")
    public ResponseEntity<ApiResponse<ProductComparisonResponse>> compareProducts(@RequestBody ProductComparisonRequest request) {
        ProductComparisonResponse comparison = aiVisionSearchService.compareProducts(request);
        return ResponseEntity.ok(ApiResponse.success("Side-by-side AI product comparison generated", comparison));
    }

    @GetMapping("/trending")
    public ResponseEntity<ApiResponse<List<String>>> getTrendingKeywords() {
        List<String> keywords = aiVisionSearchService.getTrendingSearchKeywords();
        return ResponseEntity.ok(ApiResponse.success("Trending search terms retrieved", keywords));
    }

    @GetMapping("/analytics")
    public ResponseEntity<ApiResponse<SearchAnalyticsDto>> getSearchAnalytics() {
        SearchAnalyticsDto analytics = aiVisionSearchService.getSearchAnalytics();
        return ResponseEntity.ok(ApiResponse.success("Search analytics metrics retrieved", analytics));
    }
}
