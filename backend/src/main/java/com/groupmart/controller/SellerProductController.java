package com.groupmart.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.product.CreateProductRequest;
import com.groupmart.dto.product.ProductDto;
import com.groupmart.dto.product.UpdateProductRequest;
import com.groupmart.service.ProductService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/seller/products")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SELLER', 'ADMIN')")
public class SellerProductController {

    private final ProductService productService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ProductDto>>> getMyProducts(@AuthenticationPrincipal UserDetails userDetails) {
        List<ProductDto> products = productService.getProductsBySellerEmail(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Merchant products retrieved", products));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ProductDto>> createProduct(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CreateProductRequest request
    ) {
        ProductDto created = productService.createProduct(userDetails.getUsername(), request);
        return new ResponseEntity<>(ApiResponse.success("Product created successfully", created, HttpStatus.CREATED.value()), HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ProductDto>> updateProduct(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateProductRequest request
    ) {
        ProductDto updated = productService.updateProduct(userDetails.getUsername(), id, request);
        return ResponseEntity.ok(ApiResponse.success("Product updated successfully", updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteProduct(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id
    ) {
        productService.deleteProduct(userDetails.getUsername(), id);
        return ResponseEntity.ok(ApiResponse.success("Product deleted successfully", null));
    }
}
