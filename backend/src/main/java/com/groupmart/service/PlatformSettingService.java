package com.groupmart.service;

import com.groupmart.entity.PlatformSetting;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface PlatformSettingService {

    List<PlatformSetting> getAllSettings();

    PlatformSetting getSettingByKey(String key);

    /**
     * @return every known setting key mapped to its effective value. Keys with no
     *         persisted row fall back to the canonical default, so the result is
     *         never empty on an unseeded database.
     */
    Map<String, String> getSettingsAsMap();

    /**
     * Upserts the supplied values, creating rows for keys that do not exist yet.
     *
     * @return the effective settings map after the save
     */
    Map<String, String> upsertSettings(Map<String, String> values, String updatedBy);

    PlatformSetting updateSetting(String key, String value, String updatedBy);

    PlatformSetting createSetting(String key, String value, String description, String updatedBy);
}
