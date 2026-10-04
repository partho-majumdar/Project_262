package com.groupmart.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.PlatformSetting;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PlatformSettingRepository extends JpaRepository<PlatformSetting, UUID> {

    Optional<PlatformSetting> findByKey(String key);

    List<PlatformSetting> findByKeyIn(List<String> keys);
}
