package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.support.SendSupportMessageRequest;
import com.groupmart.dto.support.SupportMessageDto;
import com.groupmart.entity.SupportMessage;
import com.groupmart.entity.User;
import com.groupmart.repository.SupportMessageRepository;
import com.groupmart.repository.UserRepository;
import com.groupmart.service.SupportService;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SupportServiceImpl implements SupportService {

    private final SupportMessageRepository supportMessageRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public List<SupportMessageDto> getConversation(String userEmail, UUID partnerId) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        return supportMessageRepository.findConversationBetweenUsers(user.getId(), partnerId)
                .stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<SupportMessageDto> getInbox(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        return supportMessageRepository.findByReceiverIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<SupportMessageDto> getSent(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        return supportMessageRepository.findBySenderIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public SupportMessageDto sendMessage(String senderEmail, SendSupportMessageRequest request) {
        User sender = userRepository.findByEmail(senderEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", senderEmail));

        UUID receiverId = UUID.fromString(request.getReceiverId());
        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", receiverId));

        SupportMessage message = SupportMessage.builder()
                .sender(sender)
                .receiver(receiver)
                .subject(request.getSubject())
                .message(request.getMessage())
                .orderNumber(request.getOrderNumber())
                .productId(request.getProductId())
                .read(false)
                .build();

        SupportMessage saved = supportMessageRepository.save(message);
        return mapToDto(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SupportMessageDto> getConversationPartners(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        List<SupportMessage> all = supportMessageRepository.findAllConversationsForUser(user.getId());
        return latestByPartner(all, user.getId()).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<SupportMessageDto> getCustomerConversations(String sellerEmail) {
        User seller = userRepository.findByEmail(sellerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", sellerEmail));

        List<SupportMessage> all = supportMessageRepository.findAllConversationsForUser(seller.getId());
        return latestByPartner(all, seller.getId()).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    private List<SupportMessage> latestByPartner(List<SupportMessage> messages, UUID userId) {
        java.util.Map<UUID, SupportMessage> latest = new java.util.LinkedHashMap<>();
        for (SupportMessage m : messages) {
            UUID partnerId = m.getSender().getId().equals(userId)
                    ? m.getReceiver().getId()
                    : m.getSender().getId();
            SupportMessage existing = latest.get(partnerId);
            if (existing == null || m.getCreatedAt().isAfter(existing.getCreatedAt())) {
                latest.put(partnerId, m);
            }
        }
        return new java.util.ArrayList<>(latest.values());
    }

    @Override
    @Transactional(readOnly = true)
    public long getUnreadCount(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        return supportMessageRepository.findByReceiverIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .filter(m -> !m.isRead())
                .count();
    }

    @Override
    @Transactional
    public SupportMessageDto markAsRead(String userEmail, UUID messageId) {
        SupportMessage message = supportMessageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("SupportMessage", "id", messageId));

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        if (!message.getReceiver().getId().equals(user.getId())) {
            throw new ResourceNotFoundException("SupportMessage", "id", messageId);
        }

        message.setRead(true);
        SupportMessage updated = supportMessageRepository.save(message);
        return mapToDto(updated);
    }

    private SupportMessageDto mapToDto(SupportMessage message) {
        return SupportMessageDto.builder()
                .id(message.getId())
                .senderId(message.getSender().getId())
                .senderName(message.getSender().getFirstName() + " " + message.getSender().getLastName())
                .senderEmail(message.getSender().getEmail())
                .receiverId(message.getReceiver().getId())
                .receiverName(message.getReceiver().getFirstName() + " " + message.getReceiver().getLastName())
                .receiverEmail(message.getReceiver().getEmail())
                .subject(message.getSubject())
                .message(message.getMessage())
                .orderNumber(message.getOrderNumber())
                .productId(message.getProductId())
                .read(message.isRead())
                .createdAt(message.getCreatedAt())
                .build();
    }
}
