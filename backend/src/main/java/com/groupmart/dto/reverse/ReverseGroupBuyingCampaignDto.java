package com.groupmart.dto.reverse;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import com.groupmart.entity.ReverseTargetType;

/** The confirmed Reverse Group Buying purchase an activated offer's individual orders hang off. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReverseGroupBuyingCampaignDto {

    private UUID id;
    private UUID offerId;
    private UUID productId;
    private String productName;
    private ReverseTargetType targetType;
    private BigDecimal unlockedUnitPrice;
    private BigDecimal basePriceAtActivation;
    private int targetQuantity;
    private int totalConfirmedQuantity;
    private int participantCount;
    private LocalDateTime activatedAt;
}
