package com.groupmart.service;

import com.groupmart.entity.GroupBuyCloseCode;

import java.util.UUID;

/**
 * State transitions shared by customer actions, seller/admin actions and the scheduler.
 * Every method locks the campaign row before any group row to keep lock order consistent.
 */
public interface GroupBuyLifecycleService {

    /** Reserves inventory and makes the campaign ACTIVE (from DRAFT, SCHEDULED or PAUSED). */
    void activateCampaign(UUID campaignId, boolean triggeredBySchedule);

    /** Settles an open group if it has expired or is full: creates orders on success, refunds on failure. */
    void settleGroup(UUID groupId);

    /** Ends a campaign now: settles all open groups and releases unsold inventory. */
    void closeCampaign(UUID campaignId, String note);

    /** Cancels a campaign: refunds all open groups and releases inventory. */
    void cancelCampaign(UUID campaignId, String reason, GroupBuyCloseCode code);

    /** Cancels one open group and refunds its members (admin moderation). */
    void cancelGroup(UUID groupId, String reason);

    /**
     * Removes an active member from an open group with a full refund, handing leadership over if needed.
     * {@code removedByAdmin} switches the notifications from "you left" to "you were removed".
     */
    void removeMember(UUID groupId, UUID userId, boolean removedByAdmin, String reason);

    void sendExpiryReminder(UUID groupId);

    /** Tells followers of an active deal that it ends within a day. Sent once per campaign. */
    void sendFollowerEndingReminder(UUID campaignId);
}
