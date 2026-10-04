package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.groupmart.entity.GroupBuyCampaign;
import com.groupmart.entity.GroupBuyCampaignStatus;
import com.groupmart.entity.GroupBuyDealFollow;
import com.groupmart.entity.GroupBuyGroup;
import com.groupmart.repository.GroupBuyDealFollowRepository;
import com.groupmart.repository.GroupBuyParticipantRepository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import static com.groupmart.service.impl.GroupBuyEventRecorder.*;

/** Notifications for shoppers following a group deal: launches, new discounts, expiry and closing. */
@Component
@RequiredArgsConstructor
public class GroupBuyDealAlerts {

    public static final long ENDING_SOON_HOURS = 24;
    private static final String DEAL_LINK_PREFIX = "/group-deals/";

    private final GroupBuyDealFollowRepository followRepository;
    private final GroupBuyParticipantRepository participantRepository;
    private final GroupBuyEventRecorder events;

    public static String dealLink(UUID campaignId) {
        return DEAL_LINK_PREFIX + campaignId;
    }

    public void dealLive(GroupBuyCampaign campaign, boolean resumed) {
        String title = resumed ? "A deal you follow is back" : "A deal you follow is live";
        String message = "'" + shortText(campaign.getTitle(), 80) + "' is accepting groups until "
                + formatTime(campaign.getEndAt()) + ". Prices drop to " + money(GroupBuyPricing.lowestPrice(campaign))
                + " as groups grow.";
        for (GroupBuyDealFollow follow : followRepository.findByCampaignId(campaign.getId())) {
            events.notify(follow.getUser(), title, message, "GROUP_BUY_DEAL_LIVE", dealLink(campaign.getId()));
        }
    }

    /** A group unlocked a cheaper tier; tell followers who aren't already in a group, once per new low price. */
    public void priceUnlocked(GroupBuyCampaign campaign, GroupBuyGroup group, BigDecimal unitPrice) {
        String discount = GroupBuyPricing.discountPercent(campaign.getBasePrice(), unitPrice)
                .stripTrailingZeros().toPlainString();
        String message = "A group for '" + shortText(campaign.getProduct().getName(), 60) + "' unlocked "
                + money(unitPrice) + " each (" + discount + "% off). Join it with code " + group.getInviteCode()
                + " before it fills up.";
        for (GroupBuyDealFollow follow : followRepository.findByCampaignId(campaign.getId())) {
            BigDecimal alerted = follow.getLastAlertedPrice();
            if ((alerted != null && unitPrice.compareTo(alerted) >= 0) || inActiveGroup(follow, campaign)) {
                continue;
            }
            follow.setLastAlertedPrice(unitPrice);
            events.notify(follow.getUser(), "New group discount on a deal you follow", message,
                    "GROUP_BUY_DEAL_DISCOUNT", groupLink(group.getId()));
        }
    }

    public void endingSoon(GroupBuyCampaign campaign) {
        String message = "'" + shortText(campaign.getTitle(), 80) + "' ends " + formatTime(campaign.getEndAt())
                + ". Start or join a group before the deal closes.";
        for (GroupBuyDealFollow follow : followRepository.findByCampaignId(campaign.getId())) {
            if (!inActiveGroup(follow, campaign)) {
                events.notify(follow.getUser(), "A deal you follow ends soon", message,
                        "GROUP_BUY_DEAL_ENDING", dealLink(campaign.getId()));
            }
        }
        campaign.setFollowersEndingAlertAt(LocalDateTime.now());
    }

    public void dealEnded(GroupBuyCampaign campaign) {
        boolean cancelled = campaign.getStatus() == GroupBuyCampaignStatus.CANCELLED;
        String title = cancelled ? "A deal you follow was cancelled" : "A deal you follow has ended";
        String message = "'" + shortText(campaign.getTitle(), 80) + "' "
                + (cancelled ? "was cancelled by the seller or an administrator." : "is no longer accepting groups.")
                + " Any payments for open groups were refunded.";
        for (GroupBuyDealFollow follow : followRepository.findByCampaignId(campaign.getId())) {
            events.notify(follow.getUser(), title, message, "GROUP_BUY_DEAL_ENDED", dealLink(campaign.getId()));
        }
    }

    private boolean inActiveGroup(GroupBuyDealFollow follow, GroupBuyCampaign campaign) {
        return !participantRepository.findActiveGroupIdsInCampaign(follow.getUser().getId(), campaign.getId()).isEmpty();
    }
}
