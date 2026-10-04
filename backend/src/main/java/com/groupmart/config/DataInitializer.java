package com.groupmart.config;

import com.groupmart.common.constant.PlatformSettingKeys;
import com.groupmart.entity.Category;
import com.groupmart.entity.PlatformSetting;
import com.groupmart.entity.Role;
import com.groupmart.entity.SellerStatus;
import com.groupmart.entity.User;
import com.groupmart.repository.CategoryRepository;
import com.groupmart.repository.PlatformSettingRepository;
import com.groupmart.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final PlatformSettingRepository platformSettingRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.seed-data:false}")
    private boolean seedData;

    @Override
    public void run(String... args) throws Exception {
        if (!seedData) {
            log.info("Data seeding is DISABLED. Starting with empty database.");
            return;
        }

        log.info("Seeding initial data...");
        seedAdminOnly();
        seedCategories();
        seedSettings();
        log.info("Initial data seeding complete!");
    }

    private void seedAdminOnly() {
        if (!userRepository.existsByEmail("admin@groupmart.com")) {
            User admin = User.builder()
                    .email("admin@groupmart.com")
                    .password(passwordEncoder.encode("Admin@12345"))
                    .firstName("Admin")
                    .lastName("User")
                    .phone(null)
                    .avatarUrl(null)
                    .role(Role.ROLE_ADMIN)
                    .sellerStatus(SellerStatus.NONE)
                    .enabled(true)
                    .build();
            userRepository.save(admin);
            log.info("Seeded admin user: admin@groupmart.com");
        } else {
            log.info("Admin user already exists, skipping.");
        }
    }

    private void seedCategories() {
        if (categoryRepository.count() > 0) {
            log.info("Categories already exist, skipping category seeding.");
            return;
        }

        List<Category> categories = List.of(
                Category.builder().name("Electronics").slug("electronics").description("Smartphones, laptops, audio, cameras, and more").imageUrl("https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Smartphones & Tablets").slug("smartphones-tablets").description("Mobile phones, tablets, and accessories").imageUrl("https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Laptops & Computers").slug("laptops-computers").description("Notebooks, desktops, components, and peripherals").imageUrl("https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Audio & Headphones").slug("audio-headphones").description("Headphones, speakers, earphones, and sound systems").imageUrl("https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Cameras & Photography").slug("cameras-photography").description("DSLR, mirrorless, action cameras, and lenses").imageUrl("https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Gaming").slug("gaming").description("Consoles, accessories, gaming laptops, and VR").imageUrl("https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Smart Home & IoT").slug("smart-home-iot").description("Smart speakers, lights, security, and automation").imageUrl("https://images.unsplash.com/photo-1558002038-1055907df827?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Wearables").slug("wearables").description("Smart watches, fitness trackers, and VR headsets").imageUrl("https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Fashion").slug("fashion").description("Clothing, footwear, accessories, and jewelry").imageUrl("https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Men's Fashion").slug("mens-fashion").description("Shirts, pants, suits, and men's accessories").imageUrl("https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Women's Fashion").slug("womens-fashion").description("Dresses, tops, skirts, and women's accessories").imageUrl("https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Shoes").slug("shoes").description("Sneakers, formal shoes, sandals, and boots").imageUrl("https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Jewelry & Watches").slug("jewelry-watches").description("Rings, necklaces, bracelets, and luxury watches").imageUrl("https://images.unsplash.com/photo-1515562141589-67f0d569b6c2?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Home & Kitchen").slug("home-kitchen").description("Furniture, decor, kitchenware, and appliances").imageUrl("https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Furniture").slug("furniture").description("Sofas, beds, tables, chairs, and storage").imageUrl("https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Kitchen & Dining").slug("kitchen-dining").description("Cookware, cutlery, appliances, and tableware").imageUrl("https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Home Decor").slug("home-decor").description("Wall art, lighting, rugs, and decorative accessories").imageUrl("https://images.unsplash.com/photo-1618220179428-22790b461013?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Beauty & Personal Care").slug("beauty-personal-care").description("Skincare, makeup, haircare, and grooming").imageUrl("https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Skincare").slug("skincare").description("Moisturizers, serums, cleansers, and sunscreens").imageUrl("https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Haircare").slug("haircare").description("Shampoos, conditioners, styling tools, and treatments").imageUrl("https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Makeup").slug("makeup").description("Lipsticks, eyeshadows, foundations, and brushes").imageUrl("https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Sports & Outdoors").slug("sports-outdoors").description("Exercise equipment, outdoor gear, and sportswear").imageUrl("https://images.unsplash.com/photo-1517649763962-0c623266010b?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Fitness & Training").slug("fitness-training").description("Gym equipment, yoga mats, dumbbells, and accessories").imageUrl("https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Outdoor Recreation").slug("outdoor-recreation").description("Camping, hiking, cycling, and water sports").imageUrl("https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Sportswear").slug("sportswear").description("Athletic shoes, workout clothes, and sports accessories").imageUrl("https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Automotive").slug("automotive").description("Car parts, accessories, tools, and care products").imageUrl("https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Car Electronics").slug("car-electronics").description("Dash cams, GPS, car audio, and diagnostic tools").imageUrl("https://images.unsplash.com/photo-1558449028-b53a39d100fc?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Car Care").slug("car-care").description("Waxes, cleaners, interior care, and detailing kits").imageUrl("https://images.unsplash.com/photo-1520340356584-f9918d35f5d6?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Books & Media").slug("books-media").description("Fiction, non-fiction, textbooks, and audiobooks").imageUrl("https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Toys & Games").slug("toys-games").description("Board games, puzzles, action figures, and educational toys").imageUrl("https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Baby & Kids").slug("baby-kids").description("Strollers, car seats, clothing, and nursery items").imageUrl("https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Pet Supplies").slug("pet-supplies").description("Food, toys, grooming, and accessories for pets").imageUrl("https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Health & Wellness").slug("health-wellness").description("Vitamins, supplements, fitness gear, and medical supplies").imageUrl("https://images.unsplash.com/photo-1505576399279-538d247d5b8f?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Grocery & Gourmet Food").slug("grocery-gourmet-food").description("Organic foods, snacks, beverages, and specialty items").imageUrl("https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Office Supplies").slug("office-supplies").description("Stationery, printers, furniture, and organization").imageUrl("https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&auto=format&fit=crop").active(true).build(),
                Category.builder().name("Industrial & Scientific").slug("industrial-scientific").description("Lab equipment, tools, safety gear, and materials").imageUrl("https://images.unsplash.com/photo-1581093458791-9f302e4d0169?w=600&auto=format&fit=crop").active(true).build()
        );

        categoryRepository.saveAll(categories);
        log.info("Seeded {} categories.", categories.size());
    }

    /**
     * Persists the canonical platform setting defaults. Runs per key so an existing
     * value edited by an admin is never overwritten on restart.
     */
    private void seedSettings() {
        Map<String, String> defaults = PlatformSettingKeys.defaults();
        Map<String, String> descriptions = PlatformSettingKeys.descriptions();

        int created = 0;
        for (Map.Entry<String, String> entry : defaults.entrySet()) {
            String key = entry.getKey();
            if (platformSettingRepository.findByKey(key).isPresent()) {
                continue;
            }
            platformSettingRepository.save(PlatformSetting.builder()
                    .key(key)
                    .value(entry.getValue())
                    .description(descriptions.get(key))
                    .build());
            created++;
        }

        if (created > 0) {
            log.info("Seeded {} platform settings.", created);
        } else {
            log.info("Platform settings already exist, skipping settings seeding.");
        }
    }
}
