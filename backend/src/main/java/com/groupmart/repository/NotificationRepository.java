package com.groupmart.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.Notification;

import java.util.List;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    List<Notification> findByUserIdOrderByCreatedAtDesc(UUID userId);

    /** Newest first, capped, so the bell never loads a user's whole history. */
    List<Notification> findByUserIdOrderByCreatedAtDesc(UUID userId, org.springframework.data.domain.Pageable pageable);

    List<Notification> findByUserIdAndReadFalse(UUID userId);

    long countByUserIdAndReadFalse(UUID userId);
}
