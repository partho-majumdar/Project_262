package com.groupmart.settings;

import com.groupmart.common.constant.PlatformSettingKeys;
import com.groupmart.entity.PlatformSetting;
import com.groupmart.repository.PlatformSettingRepository;
import com.groupmart.service.PlatformSettingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Platform settings behaviour behind the admin Settings tab.
 *
 * <p>These run against a database where {@code app.seed-data=false}, which is the real
 * failing case: the {@code platform_settings} table is empty, so the tab used to receive
 * an empty array and had nothing to render.
 */
@SpringBootTest
@ActiveProfiles("test")
class PlatformSettingServiceTest {

    @Autowired private PlatformSettingService platformSettingService;
    @Autowired private PlatformSettingRepository platformSettingRepository;

    @BeforeEach
    void clearSettings() {
        platformSettingRepository.deleteAll();
        platformSettingRepository.flush();
    }

    @Test
    void emptyTableStillYieldsEveryDefaultKey() {
        Map<String, String> settings = platformSettingService.getSettingsAsMap();

        assertFalse(settings.isEmpty(), "An unseeded database must still expose settings to the admin UI");
        for (String key : PlatformSettingKeys.defaults().keySet()) {
            assertTrue(settings.containsKey(key), "Missing default key: " + key);
        }
        assertEquals("true", settings.get(PlatformSettingKeys.PAYMENT_STRIPE_ENABLED));
        assertEquals("Flat Rate ৳5.00", settings.get(PlatformSettingKeys.SHIPPING_TIER));
        assertEquals("15.0", settings.get(PlatformSettingKeys.COMMISSION_RATE));
    }

    @Test
    void persistedValueOverridesTheDefault() {
        platformSettingRepository.saveAndFlush(PlatformSetting.builder()
                .key(PlatformSettingKeys.PAYMENT_STRIPE_ENABLED)
                .value("false")
                .build());

        assertEquals("false", platformSettingService.getSettingsAsMap().get(PlatformSettingKeys.PAYMENT_STRIPE_ENABLED));
    }

    @Test
    void upsertCreatesKeysThatWereNeverSeeded() {
        Map<String, String> saved = platformSettingService.upsertSettings(
                Map.of(PlatformSettingKeys.PAYMENT_PAYPAL_ENABLED, "false"), "admin@groupmart.com");

        assertEquals("false", saved.get(PlatformSettingKeys.PAYMENT_PAYPAL_ENABLED));
        assertTrue(platformSettingRepository.findByKey(PlatformSettingKeys.PAYMENT_PAYPAL_ENABLED).isPresent(),
                "Upsert must create a missing row instead of failing");

        // Untouched keys must still resolve to their defaults.
        assertEquals("true", saved.get(PlatformSettingKeys.PAYMENT_STRIPE_ENABLED));
    }

    @Test
    void upsertOverwritesAnExistingValueAndRecordsTheEditor() {
        platformSettingRepository.saveAndFlush(PlatformSetting.builder()
                .key(PlatformSettingKeys.COMMISSION_RATE)
                .value("10.0")
                .build());

        Map<String, String> saved = platformSettingService.upsertSettings(
                Map.of(PlatformSettingKeys.COMMISSION_RATE, "22.5"), "root@groupmart.com");

        assertEquals("22.5", saved.get(PlatformSettingKeys.COMMISSION_RATE));
        PlatformSetting row = platformSettingRepository.findByKey(PlatformSettingKeys.COMMISSION_RATE).orElseThrow();
        assertEquals("root@groupmart.com", row.getUpdatedBy());
        assertEquals(1, platformSettingRepository.count(), "An upsert must not create a duplicate row");
    }

    @Test
    void updateSettingCreatesTheRowWhenAbsent() {
        PlatformSetting created = platformSettingService.updateSetting(
                PlatformSettingKeys.ORDER_AUTO_CANCEL_HOURS, "24", "admin@groupmart.com");

        assertNotNull(created.getId());
        assertEquals("24", created.getValue());
    }

    @Test
    void bulkUpsertIgnoresBlankAndNullEntries() {
        Map<String, String> payload = new HashMap<>();
        payload.put(PlatformSettingKeys.SHIPPING_TIER, "Free Shipping Tier");
        payload.put("", "ignored");
        payload.put("   ", "ignored");
        payload.put(PlatformSettingKeys.COMMISSION_RATE, null);

        Map<String, String> saved = platformSettingService.upsertSettings(payload, "admin@groupmart.com");

        assertEquals("Free Shipping Tier", saved.get(PlatformSettingKeys.SHIPPING_TIER));
        assertEquals("15.0", saved.get(PlatformSettingKeys.COMMISSION_RATE),
                "A null value must not wipe the existing commission rate");
        assertFalse(platformSettingRepository.findByKey("").isPresent());
    }
}
