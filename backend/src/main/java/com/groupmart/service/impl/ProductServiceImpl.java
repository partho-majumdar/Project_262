package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.product.CreateProductRequest;
import com.groupmart.dto.product.ProductDto;
import com.groupmart.dto.product.UpdateProductRequest;
import com.groupmart.entity.Category;
import com.groupmart.entity.Product;
import com.groupmart.entity.Role;
import com.groupmart.entity.SellerStore;
import com.groupmart.entity.User;
import com.groupmart.repository.CategoryRepository;
import com.groupmart.repository.ProductRepository;
import com.groupmart.repository.SellerStoreRepository;
import com.groupmart.repository.UserRepository;
import com.groupmart.service.ProductService;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductServiceImpl implements ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final SellerStoreRepository sellerStoreRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public Page<ProductDto> getProducts(String query, String categorySlug, Double minPrice, Double maxPrice, Pageable pageable) {
        String searchQuery = (query != null && !query.trim().isEmpty()) ? query.trim() : null;
        String catSlug = (categorySlug != null && !categorySlug.trim().isEmpty()) ? categorySlug.trim() : null;

        return productRepository.filterProducts(searchQuery, catSlug, minPrice, maxPrice, pageable)
                .map(this::mapToDto);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ProductDto> getDealsProducts(Pageable pageable) {
        return productRepository.findDealsProducts(pageable).map(this::mapToDto);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ProductDto> getNewArrivalsProducts(Pageable pageable) {
        return productRepository.findNewArrivalsProducts(pageable).map(this::mapToDto);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ProductDto> getTrendingProducts(Pageable pageable) {
        return productRepository.findTrendingProducts(pageable).map(this::mapToDto);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductDto> getFeaturedProducts() {
        return productRepository.findByFeaturedTrueAndActiveTrue().stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductDto> getProductsByCategorySlug(String categorySlug) {
        return productRepository.findByCategorySlugAndActiveTrue(categorySlug).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ProductDto getProductBySlug(String slug) {
        Product product = productRepository.findBySlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "slug", slug));
        return mapToDto(product);
    }

    @Override
    @Transactional(readOnly = true)
    public ProductDto getProductById(UUID id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", id));
        return mapToDto(product);
    }

    @Override
    @Transactional
    public ProductDto createProduct(String userEmail, CreateProductRequest request) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        // SellerStore store = null;
        // if (user.getRole() == Role.ROLE_SELLER || user.getRole() == Role.ROLE_ADMIN) {
        //     store = sellerStoreRepository.findByUserId(user.getId()).orElse(null);
        // }

        // Category category = categoryRepository.findById(request.getCategoryId())
        //         .orElseThrow(() -> new ResourceNotFoundException("Category", "id", request.getCategoryId()));
        SellerStore store = sellerStoreRepository.findByUserId(user.getId())
            .orElseThrow(() -> new ApiException(
                "Create a seller store before adding products",
                HttpStatus.BAD_REQUEST));

        Category category = categoryRepository.findById(request.getCategoryId())
            .orElseThrow(() -> new ResourceNotFoundException("Category", "id", request.getCategoryId()));

        String slug = generateSlug(request.getName());
        String sku = generateSku(request.getName());

        Product product = Product.builder()
                .name(request.getName())
                .sku(sku)
                .slug(slug)
                .description(request.getDescription())
                .price(request.getPrice())
                .compareAtPrice(request.getCompareAtPrice())
                .category(category)
                .sellerStore(store)
                .stockQuantity(request.getStockQuantity())
                .imageUrls(request.getImageUrls() != null ? request.getImageUrls() : new ArrayList<>())
                .featured(request.isFeatured())
                .active(true)
                .build();

        Product saved = productRepository.save(product);
        return mapToDto(saved);
    }

    @Override
    @Transactional
    public ProductDto updateProduct(String userEmail, UUID id, UpdateProductRequest request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", id));

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        if (user.getRole() == Role.ROLE_SELLER) {
            SellerStore store = sellerStoreRepository.findByUserId(user.getId())
                    .orElseThrow(() -> new ApiException("Merchant store profile not found", HttpStatus.FORBIDDEN));
            if (product.getSellerStore() == null || !product.getSellerStore().getId().equals(store.getId())) {
                throw new ApiException("Not authorized to modify this merchant product", HttpStatus.FORBIDDEN);
            }
        }

        if (request.getName() != null && !request.getName().trim().isEmpty()) {
            product.setName(request.getName().trim());
        }
        if (request.getDescription() != null) {
            product.setDescription(request.getDescription());
        }
        if (request.getPrice() != null) {
            product.setPrice(request.getPrice());
        }
        if (request.getCompareAtPrice() != null) {
            product.setCompareAtPrice(request.getCompareAtPrice());
        }
        if (request.getStockQuantity() != null) {
            product.setStockQuantity(request.getStockQuantity());
        }
        if (request.getImageUrls() != null) {
            product.setImageUrls(request.getImageUrls());
        }
        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category", "id", request.getCategoryId()));
            product.setCategory(category);
        }

        Product updated = productRepository.save(product);
        return mapToDto(updated);
    }

    @Override
    @Transactional
    public void deleteProduct(String userEmail, UUID id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", id));

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        if (user.getRole() == Role.ROLE_SELLER) {
            SellerStore store = sellerStoreRepository.findByUserId(user.getId())
                    .orElseThrow(() -> new ApiException("Merchant store profile not found", HttpStatus.FORBIDDEN));
            if (product.getSellerStore() == null || !product.getSellerStore().getId().equals(store.getId())) {
                throw new ApiException("Not authorized to delete this merchant product", HttpStatus.FORBIDDEN);
            }
        }

        product.setActive(false);
        productRepository.save(product);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductDto> getProductsBySellerEmail(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));
        SellerStore store = sellerStoreRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ApiException("Seller store not found", HttpStatus.NOT_FOUND));
        return productRepository.findBySellerStoreId(store.getId()).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    private String generateSlug(String name) {
        String baseSlug = name.toLowerCase().replaceAll("[^a-z0-9]", "-").replaceAll("-+", "-");
        String slug = baseSlug;
        int count = 1;
        while (productRepository.existsBySlug(slug)) {
            slug = baseSlug + "-" + count++;
        }
        return slug;
    }

    private String generateSku(String name) {
        String cleanName = name.replaceAll("[^A-Za-z0-9]", "").toUpperCase();
        String prefix = cleanName.length() >= 4 ? cleanName.substring(0, 4) : "PROD";
        String randomDigits = String.format("%04d", (int) (Math.random() * 10000));
        String sku = "NEX-" + prefix + "-" + randomDigits;

        while (productRepository.existsBySku(sku)) {
            randomDigits = String.format("%04d", (int) (Math.random() * 10000));
            sku = "NEX-" + prefix + "-" + randomDigits;
        }
        return sku;
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
