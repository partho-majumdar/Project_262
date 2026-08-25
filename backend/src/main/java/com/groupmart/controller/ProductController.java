package com.groupmart.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.product.ProductDto;
import com.groupmart.service.ProductService;

import java.util.List;

@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<ProductDto>>> getProducts(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String categorySlug,
            @RequestParam(required = false) Double minPrice,
            @RequestParam(required = false) Double maxPrice,
            @RequestParam(defaultValue = "newest") String sortBy,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size
    ) {
        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt");
        if ("price_asc".equalsIgnoreCase(sortBy)) {
            sort = Sort.by(Sort.Direction.ASC, "price");
        } else if ("price_desc".equalsIgnoreCase(sortBy)) {
            sort = Sort.by(Sort.Direction.DESC, "price");
        } else if ("rating".equalsIgnoreCase(sortBy)) {
            sort = Sort.by(Sort.Direction.DESC, "rating");
        }

        Pageable pageable = PageRequest.of(page, size, sort);
        Page<ProductDto> products = productService.getProducts(query, categorySlug, minPrice, maxPrice, pageable);
        return ResponseEntity.ok(ApiResponse.success("Products catalog retrieved successfully", products));
    }

    @GetMapping("/deals")
    public ResponseEntity<ApiResponse<Page<ProductDto>>> getDealsProducts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<ProductDto> deals = productService.getDealsProducts(pageable);
        return ResponseEntity.ok(ApiResponse.success("Today's deals products retrieved", deals));
    }

    @GetMapping("/new-arrivals")
    public ResponseEntity<ApiResponse<Page<ProductDto>>> getNewArrivalsProducts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<ProductDto> newArrivals = productService.getNewArrivalsProducts(pageable);
        return ResponseEntity.ok(ApiResponse.success("New arrivals products retrieved", newArrivals));
    }

    @GetMapping("/trending")
    public ResponseEntity<ApiResponse<Page<ProductDto>>> getTrendingProducts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<ProductDto> trending = productService.getTrendingProducts(pageable);
        return ResponseEntity.ok(ApiResponse.success("Trending products retrieved", trending));
    }

    @GetMapping("/featured")
    public ResponseEntity<ApiResponse<List<ProductDto>>> getFeaturedProducts() {
        List<ProductDto> featured = productService.getFeaturedProducts();
        return ResponseEntity.ok(ApiResponse.success("Featured products retrieved", featured));
    }

    @GetMapping("/category/{categorySlug}")
    public ResponseEntity<ApiResponse<List<ProductDto>>> getProductsByCategory(@PathVariable String categorySlug) {
        List<ProductDto> products = productService.getProductsByCategorySlug(categorySlug);
        return ResponseEntity.ok(ApiResponse.success("Category products retrieved", products));
    }

    @GetMapping("/{slug}")
    public ResponseEntity<ApiResponse<ProductDto>> getProductBySlug(@PathVariable String slug) {
        ProductDto product = productService.getProductBySlug(slug);
        return ResponseEntity.ok(ApiResponse.success("Product details retrieved successfully", product));
    }
}
