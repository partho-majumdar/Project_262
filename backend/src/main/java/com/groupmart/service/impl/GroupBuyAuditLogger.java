package com.groupmart.service.impl;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.groupmart.entity.GroupBuyCampaign;
import com.groupmart.service.AuditLogService;

/**
 * Writes group buy moderation and seller/customer actions to the platform audit log.
 * Every action starts with "GROUP_BUY_" so the admin Group Buying audit view can filter on it.
 */
@Component
@RequiredArgsConstructor
public class GroupBuyAuditLogger {

    public static final String CAMPAIGN = "GROUP_BUY_CAMPAIGN";
    public static final String GROUP = "GROUP_BUY_GROUP";
    public static final String DISPUTE = "GROUP_BUY_DISPUTE";
    public static final String FLAG = "GROUP_BUY_FLAG";

    private final AuditLogService auditLogService;

    public void record(String actorEmail, String action, String resource, String details) {
        auditLogService.logActivity(actorEmail != null ? actorEmail : "SYSTEM", "GROUP_BUY_" + action, resource,
                GroupBuyEventRecorder.shortText(details, 1000), clientIp());
    }

    public void campaign(String actorEmail, String action, GroupBuyCampaign campaign, String extra) {
        record(actorEmail, action, CAMPAIGN, describe(campaign) + (extra != null && !extra.isBlank() ? ". " + extra : ""));
    }

    public static String describe(GroupBuyCampaign campaign) {
        return "Campaign '" + GroupBuyEventRecorder.shortText(campaign.getTitle(), 80) + "' [" + campaign.getId()
                + "] by " + campaign.getSellerStore().getStoreName();
    }

    private static String clientIp() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs)) {
            return "system";
        }
        HttpServletRequest request = attrs.getRequest();
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded != null && !forwarded.isBlank() ? forwarded.split(",")[0].trim() : request.getRemoteAddr();
    }
}
