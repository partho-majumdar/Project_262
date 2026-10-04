package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.constant.PlatformSettingKeys;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.entity.PlatformSetting;
import com.groupmart.repository.PlatformSettingRepository;
import com.groupmart.service.PlatformSettingService;

import java.util.*;

@Service
@RequiredArgsConstructor
public class PlatformSettingServiceImpl implements PlatformSettingService {

    private final PlatformSettingRepository platformSettingRepository;

    @Override
    @Transactional(readOnly = true)
    public List<PlatformSetting> getAllSettings() {
        return platformSettingRepository.findAll();
    }

    @Override
    @Transactional(readOnly = true)
    public PlatformSetting getSettingByKey(String key) {
        return platformSettingRepository.findByKey(key)
                .orElseThrow(() -> new ResourceNotFoundException("PlatformSetting", "key", key));
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, String> getSettingsAsMap() {
        // Defaults first so an unseeded database still renders a full settings screen,
        // then let persisted rows win. A plain LinkedHashMap keeps this safe against the
        // null values and duplicate keys that Collectors.toMap rejects outright.
        Map<String, String> merged = new LinkedHashMap<>(PlatformSettingKeys.defaults());
        for (PlatformSetting setting : platformSettingRepository.findAll()) {
            merged.put(setting.getKey(), setting.getValue());
        }
        return merged;
    }

    @Override
    @Transactional
    public Map<String, String> upsertSettings(Map<String, String> values, String updatedBy) {
        if (values == null || values.isEmpty()) {
            return getSettingsAsMap();
        }

        Map<String, String> descriptions = PlatformSettingKeys.descriptions();
        List<PlatformSetting> pending = new ArrayList<>();

        for (Map.Entry<String, String> entry : values.entrySet()) {
            String key = entry.getKey();
            if (key == null || key.isBlank()) {
                continue;
            }
            String value = entry.getValue();
            if (value == null) {
                continue;
            }

            PlatformSetting setting = platformSettingRepository.findByKey(key)
                    .orElseGet(() -> PlatformSetting.builder()
                            .key(key)
                            .value(value)
                            .description(descriptions.get(key))
                            .updatedBy(updatedBy)
                            .build());

            if (!value.equals(setting.getValue())) {
                setting.setValue(value);
                setting.setUpdatedBy(updatedBy);
            }
            pending.add(setting);
        }

        platformSettingRepository.saveAll(pending);
        return getSettingsAsMap();
    }

    @Override
    @Transactional
    public PlatformSetting updateSetting(String key, String value, String updatedBy) {
        // Upsert so a settings editor can write a key that was never seeded.
        PlatformSetting setting = platformSettingRepository.findByKey(key)
                .orElseGet(() -> PlatformSetting.builder()
                        .key(key)
                        .description(PlatformSettingKeys.descriptions().get(key))
                        .updatedBy(updatedBy)
                        .build());
        setting.setValue(value);
        setting.setUpdatedBy(updatedBy);
        return platformSettingRepository.save(setting);
    }

    @Override
    @Transactional
    public PlatformSetting createSetting(String key, String value, String description, String updatedBy) {
        PlatformSetting setting = PlatformSetting.builder()
                .key(key)
                .value(value)
                .description(description)
                .updatedBy(updatedBy)
                .build();
        return platformSettingRepository.save(setting);
    }
}
