package com.groupmart.dto.support;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupportMessageDto {

    private UUID id;
    private UUID senderId;
    private String senderName;
    private String senderEmail;
    private UUID receiverId;
    private String receiverName;
    private String receiverEmail;
    private String subject;
    private String message;
    private String orderNumber;
    private UUID productId;
    private boolean read;
    private LocalDateTime createdAt;
}
