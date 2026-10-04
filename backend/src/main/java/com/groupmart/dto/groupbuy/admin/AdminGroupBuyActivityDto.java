package com.groupmart.dto.groupbuy.admin;

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
public class AdminGroupBuyActivityDto {

    private UUID id;
    private String type;
    private String message;
    private String actorName;
    private String actorEmail;
    private UUID groupId;
    private String inviteCode;
    private UUID campaignId;
    private String campaignTitle;
    private LocalDateTime createdAt;
}
