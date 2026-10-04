package com.groupmart.service.impl;

import com.groupmart.entity.GroupBuyCampaign;
import com.groupmart.entity.GroupBuyCloseCode;
import com.groupmart.entity.GroupBuyGroup;

import java.util.Locale;

/** Why a group or campaign closed: the stored code, or a best guess from free text saved before codes existed. */
final class GroupBuyCloseReasons {

    private GroupBuyCloseReasons() {
    }

    static GroupBuyCloseCode forGroup(GroupBuyGroup group) {
        if (group.getCloseCode() != null) {
            return group.getCloseCode();
        }
        String reason = group.getFailureReason() == null ? "" : group.getFailureReason().toLowerCase(Locale.ROOT);
        if (reason.contains("all participants left")) {
            return GroupBuyCloseCode.ALL_MEMBERS_LEFT;
        }
        if (reason.startsWith("only ")) {
            return reason.contains("(") ? GroupBuyCloseCode.CLOSED_EARLY_BELOW_MINIMUM : GroupBuyCloseCode.NOT_ENOUGH_PARTICIPANTS;
        }
        return fromNote(reason);
    }

    static GroupBuyCloseCode forCampaign(GroupBuyCampaign campaign) {
        if (campaign.getCloseCode() != null) {
            return campaign.getCloseCode();
        }
        return fromNote(campaign.getClosingNote() == null ? "" : campaign.getClosingNote().toLowerCase(Locale.ROOT));
    }

    private static GroupBuyCloseCode fromNote(String note) {
        if (note.contains("by the seller")) {
            return GroupBuyCloseCode.CANCELLED_BY_SELLER;
        }
        if (note.contains("administrator")) {
            return GroupBuyCloseCode.CANCELLED_BY_ADMIN;
        }
        if (note.contains("window ended")) {
            return GroupBuyCloseCode.CAMPAIGN_WINDOW_ENDED;
        }
        return GroupBuyCloseCode.OTHER;
    }
}
