package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.product.BulkImportResultDto;
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

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
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

        SellerStore store = null;
        if (user.getRole() == Role.ROLE_SELLER || user.getRole() == Role.ROLE_ADMIN) {
            store = sellerStoreRepository.findByUserId(user.getId()).orElse(null);
        }

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

    // ===================== NEW BULK IMPORT METHOD =====================
    @Override
    @Transactional
    public BulkImportResultDto bulkImportProducts(String userEmail, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException("CSV file is required", HttpStatus.BAD_REQUEST);
        }

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        if (!filename.endsWith(".csv")) {
            throw new ApiException("Only .csv files are accepted", HttpStatus.BAD_REQUEST);
        }

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        SellerStore store = sellerStoreRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ApiException("Seller store not found. Create a store first.", HttpStatus.FORBIDDEN));

        List<String> errors = new ArrayList<>();
        List<ProductDto> created = new ArrayList<>();
        int totalRows = 0;
        int success = 0;

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String headerLine = reader.readLine();
            if (headerLine == null) {
                throw new ApiException("CSV file is empty", HttpStatus.BAD_REQUEST);
            }

            String[] headers = Arrays.stream(headerLine.split(",", -1))
                    .map(h -> h.trim().toLowerCase().replace("\"", ""))
                    .toArray(String[]::new);

            int nameIdx = indexOf(headers, "name");
            int priceIdx = indexOf(headers, "price");
            int categoryIdx = indexOf(headers, "categoryslug", "category_slug", "category", "categoryid", "category_id");
            int stockIdx = indexOf(headers, "stockquantity", "stock_quantity", "stock", "quantity");
            int descIdx = indexOf(headers, "description", "desc");
            int compareIdx = indexOf(headers, "compareatprice", "compare_at_price", "compareprice");
            int imagesIdx = indexOf(headers, "imageurls", "image_urls", "images", "image");
            int featuredIdx = indexOf(headers, "featured");
            int skuIdx = indexOf(headers, "sku");

            if (nameIdx < 0 || priceIdx < 0 || categoryIdx < 0) {
                throw new ApiException(
                        "CSV must contain at least columns: name, price, categorySlug (or category / categoryId)",
                        HttpStatus.BAD_REQUEST);
            }

            String line;
            int rowNum = 1;
            while ((line = reader.readLine()) != null) {
                rowNum++;
                if (line.trim().isEmpty()) continue;
                totalRows++;

                try {
                    String[] cols = parseCsvLine(line);

                    String name = getCol(cols, nameIdx);
                    if (name == null || name.isBlank()) {
                        errors.add("Row " + rowNum + ": name is required");
                        continue;
                    }

                    BigDecimal price;
                    try {
                        price = new BigDecimal(getCol(cols, priceIdx).trim());
                        if (price.compareTo(BigDecimal.ZERO) < 0) {
                            errors.add("Row " + rowNum + ": price cannot be negative");
                            continue;
                        }
                    } catch (Exception e) {
                        errors.add("Row " + rowNum + ": invalid price");
                        continue;
                    }

                    String catValue = getCol(cols, categoryIdx);
                    if (catValue == null || catValue.isBlank()) {
                        errors.add("Row " + rowNum + ": category is required");
                        continue;
                    }

                    Category category = null;
                    try {
                        UUID catId = UUID.fromString(catValue.trim());
                        category = categoryRepository.findById(catId).orElse(null);
                    } catch (IllegalArgumentException ignored) {
                    }
                    if (category == null) {
                        category = categoryRepository.findBySlug(catValue.trim().toLowerCase()).orElse(null);
                    }
                    if (category == null) {
                        category = categoryRepository.findByActiveTrueOrderByNameAsc().stream()
                                .filter(c -> c.getName().equalsIgnoreCase(catValue.trim()))
                                .findFirst()
                                .orElse(null);
                    }
                    if (category == null) {
                        errors.add("Row " + rowNum + ": category not found → " + catValue);
                        continue;
                    }

                    int stock = 0;
                    if (stockIdx >= 0) {
                        try {
                            stock = Integer.parseInt(getCol(cols, stockIdx).trim());
                            if (stock < 0) stock = 0;
                        } catch (Exception ignored) {}
                    }

                    String description = descIdx >= 0 ? getCol(cols, descIdx) : null;

                    BigDecimal compareAtPrice = null;
                    if (compareIdx >= 0) {
                        String cmp = getCol(cols, compareIdx);
                        if (cmp != null && !cmp.isBlank()) {
                            try {
                                compareAtPrice = new BigDecimal(cmp.trim());
                            } catch (Exception ignored) {}
                        }
                    }

                    List<String> imageUrls = new ArrayList<>();
                    if (imagesIdx >= 0) {
                        String imgs = getCol(cols, imagesIdx);
                        if (imgs != null && !imgs.isBlank()) {
                            for (String u : imgs.split("[|;]")) {
                                if (u != null && !u.trim().isBlank()) {
                                    imageUrls.add(u.trim());
                                }
                            }
                        }
                    }

                    boolean featured = false;
                    if (featuredIdx >= 0) {
                        String f = getCol(cols, featuredIdx);
                        featured = f != null && (f.equalsIgnoreCase("true") || f.equals("1") || f.equalsIgnoreCase("yes"));
                    }

                    String customSku = skuIdx >= 0 ? getCol(cols, skuIdx) : null;
                    String sku = (customSku != null && !customSku.isBlank())
                            ? customSku.trim().toUpperCase()
                            : generateSku(name);

                    if (productRepository.existsBySku(sku)) {
                        sku = generateSku(name);
                    }

                    String slug = generateSlug(name);

                    Product product = Product.builder()
                            .name(name.trim())
                            .sku(sku)
                            .slug(slug)
                            .description(description)
                            .price(price)
                            .compareAtPrice(compareAtPrice)
                            .category(category)
                            .sellerStore(store)
                            .stockQuantity(stock)
                            .imageUrls(imageUrls)
                            .featured(featured)
                            .active(true)
                            .build();

                    Product saved = productRepository.save(product);
                    created.add(mapToDto(saved));
                    success++;

                } catch (Exception ex) {
                    errors.add("Row " + rowNum + ": " + ex.getMessage());
                }
            }
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException("Failed to parse CSV: " + e.getMessage(), HttpStatus.BAD_REQUEST);
        }

        return BulkImportResultDto.builder()
                .totalRows(totalRows)
                .successCount(success)
                .failedCount(totalRows - success)
                .errors(errors)
                .createdProducts(created)
                .build();
    }

    // ===================== HELPER METHODS =====================
    private int indexOf(String[] headers, String... candidates) {
        for (int i = 0; i < headers.length; i++) {
            for (String c : candidates) {
                if (headers[i].equals(c)) return i;
            }
        }
        return -1;
    }

    private String getCol(String[] cols, int idx) {
        if (idx < 0 || idx >= cols.length) return null;
        String v = cols[idx];
        if (v == null) return null;
        v = v.trim();
        if (v.startsWith("\"") && v.endsWith("\"") && v.length() >= 2) {
            v = v.substring(1, v.length() - 1);
        }
        return v;
    }

    private String[] parseCsvLine(String line) {
        List<String> result = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean inQuotes = false;

        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                result.add(sb.toString());
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        result.add(sb.toString());
        return result.toArray(new String[0]);
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
