package com.groupmart.dto.groupbuy;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

import com.groupmart.entity.GroupBuyParticipantStatus;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuyParticipantDto {

    private UUID id;
    private String displayName;
    private String initial;
    private boolean leader;
    private boolean invited;
    private int quantity;
    private GroupBuyParticipantStatus status;
    private LocalDateTime joinedAt;
}
