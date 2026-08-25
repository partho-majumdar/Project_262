package com.groupmart.config;

import com.groupmart.entity.*;
import com.groupmart.repository.CategoryRepository;
import com.groupmart.repository.CouponRepository;
import com.groupmart.repository.ProductRepository;
import com.groupmart.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final CouponRepository couponRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    // === NEW: Control seeding from properties ===
    @Value("${app.seed-data:false}")
    private boolean seedData;

    @Override
    public void run(String... args) throws Exception {
        if (!seedData) {
            log.info("Data seeding is DISABLED (app.seed-data=false). Starting with clean / empty database.");
            return;
        }

        log.info("Initializing GroupMart catalog data, categories & demo users...");
        seedDemoUsersIfEmpty();
        seedDefaultCategoriesIfEmpty();
        seedShoeCatalogIfEmpty();
        seedCouponsIfEmpty();
        log.info("GroupMart data initialization complete!");
    }

    private void seedDemoUsersIfEmpty() {
        if (!userRepository.existsByEmail("customer@groupmart.com")) {
            User customer = User.builder()
                    .email("customer@groupmart.com")
                    .password(passwordEncoder.encode("Customer@12345"))
                    .firstName("Test")
                    .lastName("Customer")
                    .phone("+88 555-0192")
                    .avatarUrl("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop")
                    .role(Role.ROLE_CUSTOMER)
                    .enabled(true)
                    .build();
            userRepository.save(customer);
            log.info("Seeded demo customer user: customer@groupmart.com");
        }

        if (!userRepository.existsByEmail("seller@groupmart.com")) {
            User seller = User.builder()
                    .email("seller@groupmart.com")
                    .password(passwordEncoder.encode("Seller@12345"))
                    .firstName("Marcus")
                    .lastName("Vance")
                    .phone("+88 555-0843")
                    .avatarUrl("https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop")
                    .role(Role.ROLE_SELLER)
                    .enabled(true)
                    .build();
            userRepository.save(seller);
            log.info("Seeded demo seller user: seller@groupmart.com");
        }

        if (!userRepository.existsByEmail("admin@groupmart.com")) {
            User admin = User.builder()
                    .email("admin@groupmart.com")
                    .password(passwordEncoder.encode("Admin@12345"))
                    .firstName("Sarah")
                    .lastName("Connor")
                    .phone("+88 555-0999")
                    .avatarUrl("https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop")
                    .role(Role.ROLE_ADMIN)
                    .enabled(true)
                    .build();
            userRepository.save(admin);
            log.info("Seeded demo admin user: admin@groupmart.com");
        }
    }

    private void seedDefaultCategoriesIfEmpty() {
        String[][] defaultCategories = {
            {"Electronics", "electronics", "Laptops, Smartphones, Smartwatches & Tech Accessories"},
            {"Mobiles", "mobiles", "Smartphones, Mobile Accessories & 5G Devices"},
            {"Laptops", "laptops", "Gaming Laptops, Ultrabooks & Workstations"},
            {"Fashion", "fashion", "Men's & Women's Fashion Apparel"},
            {"Clothing", "clothing", "Shirts, T-shirts, Jeans & Designer Wear"},
            {"Shoes", "shoes", "Running Shoes, Sneakers, Casual & Formal Footwear"},
            {"Sports", "sports", "Fitness Equipment, Sports Gear & Outdoor Goods"},
            {"Home & Kitchen", "home-kitchen", "Home Appliances, Furniture & Kitchenware"},
            {"Beauty", "beauty", "Cosmetics, Skincare, Makeup & Fragrances"},
            {"Books", "books", "Bestselling Fiction, Non-Fiction & Textbooks"},
            {"Toys", "toys", "Games, Action Figures & Educational Toys"},
            {"Automotive", "automotive", "Car & Bike Accessories, Tools & Electronics"},
            {"Grocery", "grocery", "Fresh Food, Beverages & Daily Essentials"}
        };

        for (String[] catData : defaultCategories) {
            String name = catData[0];
            String slug = catData[1];
            String description = catData[2];

            if (!categoryRepository.existsBySlug(slug)) {
                Category category = Category.builder()
                        .name(name)
                        .slug(slug)
                        .description(description)
                        .active(true)
                        .build();
                categoryRepository.save(category);
                log.info("Seeded category: {}", name);
            }
        }
    }

    private void seedShoeCatalogIfEmpty() {
        Category shoesCategory = categoryRepository.findBySlug("shoes").orElse(null);
        if (shoesCategory == null) return;

        List<Product> shoesList = List.of(
            Product.builder()
                .name("Nike Air Max Pulse Sneakers")
                .slug("nike-air-max-pulse-sneakers")
                .sku("NEX-NIKE-PULSE-01")
                .description("Next-gen air cushioning running shoes for high performance and daily comfort.")
                .price(new BigDecimal("149.99"))
                .compareAtPrice(new BigDecimal("179.99"))
                .category(shoesCategory)
                .stockQuantity(25)
                .rating(4.8)
                .reviewCount(142)
                .imageUrls(List.of("https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop"))
                .featured(true)
                .active(true)
                .build(),

            Product.builder()
                .name("Adidas Ultraboost Light Running Shoes")
                .slug("adidas-ultraboost-light-running-shoes")
                .sku("NEX-ADI-BOOST-02")
                .description("Ultralight responsive running footwear engineered for long distance runners.")
                .price(new BigDecimal("189.99"))
                .compareAtPrice(new BigDecimal("210.00"))
                .category(shoesCategory)
                .stockQuantity(18)
                .rating(4.9)
                .reviewCount(98)
                .imageUrls(List.of("https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&auto=format&fit=crop"))
                .featured(true)
                .active(true)
                .build(),

            Product.builder()
                .name("Puma Speedcat Pro Leather Casual Shoes")
                .slug("puma-speedcat-pro-leather-casual-shoes")
                .sku("NEX-PUMA-SPEED-03")
                .description("Iconic motorsport-inspired premium leather casual sneakers.")
                .price(new BigDecimal("119.99"))
                .compareAtPrice(new BigDecimal("139.99"))
                .category(shoesCategory)
                .stockQuantity(30)
                .rating(4.6)
                .reviewCount(64)
                .imageUrls(List.of("https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&auto=format&fit=crop"))
                .featured(false)
                .active(true)
                .build(),

            Product.builder()
                .name("Woodland Waterproof Leather Outdoor Boots")
                .slug("woodland-waterproof-leather-outdoor-boots")
                .sku("NEX-WOOD-BOOT-04")
                .description("Rugged all-terrain nubuck leather boots designed for hiking and outdoor adventure.")
                .price(new BigDecimal("159.99"))
                .compareAtPrice(new BigDecimal("189.99"))
                .category(shoesCategory)
                .stockQuantity(15)
                .rating(4.7)
                .reviewCount(112)
                .imageUrls(List.of("https://images.unsplash.com/photo-1520639888713-7851133b1ed0?w=800&auto=format&fit=crop"))
                .featured(true)
                .active(true)
                .build()
        );

        for (Product shoe : shoesList) {
            if (!productRepository.existsBySlug(shoe.getSlug())) {
                productRepository.save(shoe);
            }
        }
    }

    private void seedCouponsIfEmpty() {
        if (couponRepository.count() == 0) {
            log.info("Seeding promotional discount coupons...");

            Coupon c1 = Coupon.builder()
                    .code("WELCOME10")
                    .description("Welcome 10% promotional discount on your first order")
                    .discountType(DiscountType.PERCENTAGE)
                    .discountValue(new BigDecimal("10.00"))
                    .minOrderAmount(new BigDecimal("50.00"))
                    .expiryDate(LocalDateTime.now().plusMonths(6))
                    .active(true)
                    .build();

            Coupon c2 = Coupon.builder()
                    .code("NEXUS50")
                    .description("Flat $50 off on orders above $300")
                    .discountType(DiscountType.FIXED_AMOUNT)
                    .discountValue(new BigDecimal("50.00"))
                    .minOrderAmount(new BigDecimal("300.00"))
                    .expiryDate(LocalDateTime.now().plusMonths(6))
                    .active(true)
                    .build();

            couponRepository.saveAll(List.of(c1, c2));
        }
    }
}



// package com.groupmart.config;

// import lombok.RequiredArgsConstructor;
// import lombok.extern.slf4j.Slf4j;
// import org.springframework.boot.CommandLineRunner;
// import org.springframework.security.crypto.password.PasswordEncoder;
// import org.springframework.stereotype.Component;

// import com.groupmart.entity.*;
// import com.groupmart.repository.CategoryRepository;
// import com.groupmart.repository.CouponRepository;
// import com.groupmart.repository.ProductRepository;
// import com.groupmart.repository.UserRepository;

// import java.math.BigDecimal;
// import java.time.LocalDateTime;
// import java.util.List;

// @Component
// @RequiredArgsConstructor
// @Slf4j
// public class DataInitializer implements CommandLineRunner {

//     private final ProductRepository productRepository;
//     private final CategoryRepository categoryRepository;
//     private final CouponRepository couponRepository;
//     private final UserRepository userRepository;
//     private final PasswordEncoder passwordEncoder;

//     @Override
//     public void run(String... args) throws Exception {
//         log.info("Initializing GroupMart catalog data, categories & demo users...");
//         seedDemoUsersIfEmpty();
//         seedDefaultCategoriesIfEmpty();
//         seedShoeCatalogIfEmpty();
//         seedCouponsIfEmpty();
//         log.info("GroupMart data initialization complete!");
//     }

//     private void seedDemoUsersIfEmpty() {
//         if (!userRepository.existsByEmail("customer@groupmart.com")) {
//             User customer = User.builder()
//                     .email("customer@groupmart.com")
//                     .password(passwordEncoder.encode("Customer@12345"))
//                     .firstName("Test")
//                     .lastName("Customer")
//                     .phone("+88 555-0192")
//                     .avatarUrl("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop")
//                     .role(Role.ROLE_CUSTOMER)
//                     .enabled(true)
//                     .build();
//             userRepository.save(customer);
//             log.info("Seeded demo customer user: customer@groupmart.com");
//         }

//         if (!userRepository.existsByEmail("seller@groupmart.com")) {
//             User seller = User.builder()
//                     .email("seller@groupmart.com")
//                     .password(passwordEncoder.encode("Seller@12345"))
//                     .firstName("Marcus")
//                     .lastName("Vance")
//                     .phone("+88 555-0843")
//                     .avatarUrl("https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop")
//                     .role(Role.ROLE_SELLER)
//                     .enabled(true)
//                     .build();
//             userRepository.save(seller);
//             log.info("Seeded demo seller user: seller@groupmart.com");
//         }

//         if (!userRepository.existsByEmail("admin@groupmart.com")) {
//             User admin = User.builder()
//                     .email("admin@groupmart.com")
//                     .password(passwordEncoder.encode("Admin@12345"))
//                     .firstName("Sarah")
//                     .lastName("Connor")
//                     .phone("+88 555-0999")
//                     .avatarUrl("https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop")
//                     .role(Role.ROLE_ADMIN)
//                     .enabled(true)
//                     .build();
//             userRepository.save(admin);
//             log.info("Seeded demo admin user: admin@groupmart.com");
//         }
//     }

//     private void seedDefaultCategoriesIfEmpty() {
//         String[][] defaultCategories = {
//             {"Electronics", "electronics", "Laptops, Smartphones, Smartwatches & Tech Accessories"},
//             {"Mobiles", "mobiles", "Smartphones, Mobile Accessories & 5G Devices"},
//             {"Laptops", "laptops", "Gaming Laptops, Ultrabooks & Workstations"},
//             {"Fashion", "fashion", "Men's & Women's Fashion Apparel"},
//             {"Clothing", "clothing", "Shirts, T-shirts, Jeans & Designer Wear"},
//             {"Shoes", "shoes", "Running Shoes, Sneakers, Casual & Formal Footwear"},
//             {"Sports", "sports", "Fitness Equipment, Sports Gear & Outdoor Goods"},
//             {"Home & Kitchen", "home-kitchen", "Home Appliances, Furniture & Kitchenware"},
//             {"Beauty", "beauty", "Cosmetics, Skincare, Makeup & Fragrances"},
//             {"Books", "books", "Bestselling Fiction, Non-Fiction & Textbooks"},
//             {"Toys", "toys", "Games, Action Figures & Educational Toys"},
//             {"Automotive", "automotive", "Car & Bike Accessories, Tools & Electronics"},
//             {"Grocery", "grocery", "Fresh Food, Beverages & Daily Essentials"}
//         };

//         for (String[] catData : defaultCategories) {
//             String name = catData[0];
//             String slug = catData[1];
//             String description = catData[2];

//             if (!categoryRepository.existsBySlug(slug)) {
//                 Category category = Category.builder()
//                         .name(name)
//                         .slug(slug)
//                         .description(description)
//                         .active(true)
//                         .build();
//                 categoryRepository.save(category);
//                 log.info("Seeded category: {}", name);
//             }
//         }
//     }

//     private void seedShoeCatalogIfEmpty() {
//         Category shoesCategory = categoryRepository.findBySlug("shoes").orElse(null);
//         if (shoesCategory == null) return;

//         List<Product> shoesList = List.of(
//             Product.builder()
//                 .name("Nike Air Max Pulse Sneakers")
//                 .slug("nike-air-max-pulse-sneakers")
//                 .sku("NEX-NIKE-PULSE-01")
//                 .description("Next-gen air cushioning running shoes for high performance and daily comfort.")
//                 .price(new BigDecimal("149.99"))
//                 .compareAtPrice(new BigDecimal("179.99"))
//                 .category(shoesCategory)
//                 .stockQuantity(25)
//                 .rating(4.8)
//                 .reviewCount(142)
//                 .imageUrls(List.of("https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop"))
//                 .featured(true)
//                 .active(true)
//                 .build(),

//             Product.builder()
//                 .name("Adidas Ultraboost Light Running Shoes")
//                 .slug("adidas-ultraboost-light-running-shoes")
//                 .sku("NEX-ADI-BOOST-02")
//                 .description("Ultralight responsive running footwear engineered for long distance runners.")
//                 .price(new BigDecimal("189.99"))
//                 .compareAtPrice(new BigDecimal("210.00"))
//                 .category(shoesCategory)
//                 .stockQuantity(18)
//                 .rating(4.9)
//                 .reviewCount(98)
//                 .imageUrls(List.of("https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&auto=format&fit=crop"))
//                 .featured(true)
//                 .active(true)
//                 .build(),

//             Product.builder()
//                 .name("Puma Speedcat Pro Leather Casual Shoes")
//                 .slug("puma-speedcat-pro-leather-casual-shoes")
//                 .sku("NEX-PUMA-SPEED-03")
//                 .description("Iconic motorsport-inspired premium leather casual sneakers.")
//                 .price(new BigDecimal("119.99"))
//                 .compareAtPrice(new BigDecimal("139.99"))
//                 .category(shoesCategory)
//                 .stockQuantity(30)
//                 .rating(4.6)
//                 .reviewCount(64)
//                 .imageUrls(List.of("https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&auto=format&fit=crop"))
//                 .featured(false)
//                 .active(true)
//                 .build(),

//             Product.builder()
//                 .name("Woodland Waterproof Leather Outdoor Boots")
//                 .slug("woodland-waterproof-leather-outdoor-boots")
//                 .sku("NEX-WOOD-BOOT-04")
//                 .description("Rugged all-terrain nubuck leather boots designed for hiking and outdoor adventure.")
//                 .price(new BigDecimal("159.99"))
//                 .compareAtPrice(new BigDecimal("189.99"))
//                 .category(shoesCategory)
//                 .stockQuantity(15)
//                 .rating(4.7)
//                 .reviewCount(112)
//                 .imageUrls(List.of("https://images.unsplash.com/photo-1520639888713-7851133b1ed0?w=800&auto=format&fit=crop"))
//                 .featured(true)
//                 .active(true)
//                 .build()
//         );

//         for (Product shoe : shoesList) {
//             if (!productRepository.existsBySlug(shoe.getSlug())) {
//                 productRepository.save(shoe);
//             }
//         }
//     }

//     private void seedCouponsIfEmpty() {
//         if (couponRepository.count() == 0) {
//             log.info("Seeding promotional discount coupons...");

//             Coupon c1 = Coupon.builder()
//                     .code("WELCOME10")
//                     .description("Welcome 10% promotional discount on your first order")
//                     .discountType(DiscountType.PERCENTAGE)
//                     .discountValue(new BigDecimal("10.00"))
//                     .minOrderAmount(new BigDecimal("50.00"))
//                     .expiryDate(LocalDateTime.now().plusMonths(6))
//                     .active(true)
//                     .build();

//             Coupon c2 = Coupon.builder()
//                     .code("NEXUS50")
//                     .description("Flat $50 off on orders above $300")
//                     .discountType(DiscountType.FIXED_AMOUNT)
//                     .discountValue(new BigDecimal("50.00"))
//                     .minOrderAmount(new BigDecimal("300.00"))
//                     .expiryDate(LocalDateTime.now().plusMonths(6))
//                     .active(true)
//                     .build();

//             couponRepository.saveAll(List.of(c1, c2));
//         }
//     }
// }
