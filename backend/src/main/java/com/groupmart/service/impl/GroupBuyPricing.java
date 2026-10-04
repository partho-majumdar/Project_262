package com.groupmart.service.impl;

import com.groupmart.entity.GroupBuyCampaign;
import com.groupmart.entity.GroupBuyPriceTier;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;

/** Server-side group buy price calculations. Prices are never taken from the client. */
public final class GroupBuyPricing {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final BigDecimal ZERO_PERCENT = BigDecimal.ZERO.setScale(1);

    private GroupBuyPricing() {
    }

    public static List<GroupBuyPriceTier> sortedTiers(GroupBuyCampaign campaign) {
        return campaign.getTiers().stream()
                .sorted(Comparator.comparingInt(GroupBuyPriceTier::getMinParticipants))
                .toList();
    }

    /** Lowest price unlocked by a group of the given size, or the base price if no tier is unlocked. */
    public static BigDecimal unitPriceFor(GroupBuyCampaign campaign, int participantCount) {
        BigDecimal price = campaign.getBasePrice();
        for (GroupBuyPriceTier tier : campaign.getTiers()) {
            if (participantCount >= tier.getMinParticipants() && tier.getUnitPrice().compareTo(price) < 0) {
                price = tier.getUnitPrice();
            }
        }
        return price;
    }

    public static GroupBuyPriceTier nextTier(GroupBuyCampaign campaign, int participantCount) {
        return sortedTiers(campaign).stream()
                .filter(tier -> tier.getMinParticipants() > participantCount)
                .findFirst()
                .orElse(null);
    }

    public static BigDecimal lowestPrice(GroupBuyCampaign campaign) {
        return campaign.getTiers().stream()
                .map(GroupBuyPriceTier::getUnitPrice)
                .min(BigDecimal::compareTo)
                .orElse(campaign.getBasePrice());
    }

    public static BigDecimal discountPercent(BigDecimal basePrice, BigDecimal price) {
        if (basePrice == null || price == null || basePrice.signum() <= 0) {
            return ZERO_PERCENT;
        }
        return basePrice.subtract(price)
                .multiply(HUNDRED)
                .divide(basePrice, 1, RoundingMode.HALF_UP)
                .max(ZERO_PERCENT);
    }

    public static BigDecimal percentOf(long part, long whole) {
        return whole <= 0 ? ZERO_PERCENT
                : BigDecimal.valueOf(part).multiply(HUNDRED).divide(BigDecimal.valueOf(whole), 1, RoundingMode.HALF_UP);
    }

    public static BigDecimal lineTotal(BigDecimal unitPrice, int quantity) {
        return unitPrice.multiply(BigDecimal.valueOf(quantity)).setScale(2, RoundingMode.HALF_UP);
    }
}
