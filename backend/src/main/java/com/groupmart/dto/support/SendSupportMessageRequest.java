package com.groupmart.dto.support;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SendSupportMessageRequest {

    @NotBlank(message = "Receiver user ID is required")
    private String receiverId;

    @NotBlank(message = "Subject is required")
    @Size(max = 200, message = "Subject must be under 200 characters")
    private String subject;

    @NotBlank(message = "Message is required")
    @Size(max = 4000, message = "Message must be under 4000 characters")
    private String message;

    private String orderNumber;

    private UUID productId;
}
