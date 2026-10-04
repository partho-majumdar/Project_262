package com.groupmart.dto.groupbuy.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuyFraudFlagDto {

    /** Stable identifier: the same pattern on the same subjects always produces the same key. */
    private String key;
    private String rule;
    private String ruleLabel;
    private String severity; // HIGH, MEDIUM, LOW
    private String title;
    private String description;
    private List<FlagUser> users;
    private UUID campaignId;
    private String campaignTitle;
    private UUID groupId;
    private String inviteCode;
    private int evidenceCount;
    private LocalDateTime lastSeenAt;

    private String reviewDecision;
    private String reviewNote;
    private String reviewedByName;
    private LocalDateTime reviewedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FlagUser {
        private UUID id;
        private String name;
        private String email;
        private boolean enabled;
    }
}
