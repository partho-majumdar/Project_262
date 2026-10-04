package com.groupmart.service;

import com.groupmart.dto.groupbuy.GroupBuyCampaignDto;
import com.groupmart.dto.groupbuy.GroupBuyCampaignRequest;
import com.groupmart.dto.groupbuy.GroupBuyGroupDto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Seller campaign management and admin monitoring of group buy campaigns. */
public interface GroupBuyCampaignService {

    List<GroupBuyCampaignDto> getSellerCampaigns(String sellerEmail);

    GroupBuyCampaignDto getSellerCampaign(String sellerEmail, UUID campaignId);

    GroupBuyCampaignDto createCampaign(String sellerEmail, GroupBuyCampaignRequest request);

    GroupBuyCampaignDto updateCampaign(String sellerEmail, UUID campaignId, GroupBuyCampaignRequest request);

    /**
     * Publishes a draft straight to the storefront: SCHEDULED when the start time is still ahead,
     * otherwise ACTIVE. No admin approval step sits in between.
     */
    GroupBuyCampaignDto publishCampaign(String sellerEmail, UUID campaignId);

    GroupBuyCampaignDto pauseCampaign(String sellerEmail, UUID campaignId);

    GroupBuyCampaignDto resumeCampaign(String sellerEmail, UUID campaignId);

    GroupBuyCampaignDto cancelCampaign(String sellerEmail, UUID campaignId, String reason);

    List<GroupBuyGroupDto> getSellerCampaignGroups(String sellerEmail, UUID campaignId);

    /** Sets or clears the seller's private unit cost. Allowed in any status because shoppers never see it. */
    BigDecimal updateUnitCost(String sellerEmail, UUID campaignId, BigDecimal unitCost);

    List<GroupBuyCampaignDto> getAllCampaigns(String status);

    GroupBuyCampaignDto getCampaignForAdmin(UUID campaignId);

    List<GroupBuyGroupDto> getCampaignGroupsForAdmin(UUID campaignId);

    GroupBuyCampaignDto forceCloseCampaign(String adminEmail, UUID campaignId, String reason);

    GroupBuyCampaignDto adminCancelCampaign(String adminEmail, UUID campaignId, String reason);
}
