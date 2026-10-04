package com.groupmart.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.SupportMessage;

import java.util.List;
import java.util.UUID;

@Repository
public interface SupportMessageRepository extends JpaRepository<SupportMessage, UUID> {

    List<SupportMessage> findBySenderIdOrderByCreatedAtDesc(UUID senderId);

    List<SupportMessage> findByReceiverIdOrderByCreatedAtDesc(UUID receiverId);

    @Query("SELECT m FROM SupportMessage m WHERE (m.sender.id = :userId AND m.receiver.id = :partnerId) OR (m.sender.id = :partnerId AND m.receiver.id = :userId) ORDER BY m.createdAt ASC")
    List<SupportMessage> findConversationBetweenUsers(@Param("userId") UUID userId, @Param("partnerId") UUID partnerId);

    @Query("SELECT m FROM SupportMessage m WHERE (m.sender.id = :userId OR m.receiver.id = :userId) ORDER BY m.createdAt DESC")
    List<SupportMessage> findAllConversationsForUser(@Param("userId") UUID userId);

    @Query("SELECT DISTINCT CASE WHEN m.sender.id = :userId THEN m.receiver.id ELSE m.sender.id END FROM SupportMessage m WHERE m.sender.id = :userId OR m.receiver.id = :userId")
    List<UUID> findConversationPartnerIds(@Param("userId") UUID userId);
}
