package com.groupmart.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

import com.groupmart.dto.product.BulkImportResultDto;
import com.groupmart.dto.product.CreateProductRequest;
import com.groupmart.dto.product.ProductDto;
import com.groupmart.dto.product.UpdateProductRequest;

import java.util.List;
import java.util.UUID;

public interface ProductService {

    Page<ProductDto> getProducts(String query, String categorySlug, Double minPrice, Double maxPrice, Pageable pageable);

    Page<ProductDto> getDealsProducts(Pageable pageable);

    Page<ProductDto> getNewArrivalsProducts(Pageable pageable);

    Page<ProductDto> getTrendingProducts(Pageable pageable);

    List<ProductDto> getFeaturedProducts();

    List<ProductDto> getProductsByCategorySlug(String categorySlug);

    ProductDto getProductBySlug(String slug);

    ProductDto getProductById(UUID id);

    ProductDto createProduct(String userEmail, CreateProductRequest request);

    ProductDto updateProduct(String userEmail, UUID id, UpdateProductRequest request);

    void deleteProduct(String userEmail, UUID id);

    List<ProductDto> getProductsBySellerEmail(String userEmail);

    BulkImportResultDto bulkImportProducts(String userEmail, MultipartFile file);
}