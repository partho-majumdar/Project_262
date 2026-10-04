package com.groupmart.service;

import java.util.List;
import java.util.UUID;

import com.groupmart.dto.groupr.CreateGroupReverseDemandRequest;
import com.groupmart.dto.groupr.GroupReverseDemandDto;
import com.groupmart.dto.groupr.GroupReverseMemberDto;
import com.groupmart.dto.groupr.UpdateGroupReverseDemandRequest;

/**
 * Customer-created group purchasing demands.
 * <p>
 * A separate mechanism from {@link com.groupmart.service.ReverseGroupBuyingCampaignService}: there
 * the seller sets the target and the price, here the customer sets the quantity and the acceptable
 * price and sellers compete for the business.
 * <p>
 * The leader is the demand creator and the only offer-selection authority. The leader is never
 * treated as the buyer for the rest of the group.
 */
public interface GroupReverseDemandService {

    GroupReverseDemandDto createDemand(String leaderEmail, CreateGroupReverseDemandRequest request);

    GroupReverseDemandDto updateDemand(String leaderEmail, UUID demandId, UpdateGroupReverseDemandRequest request);

    /** Makes a draft discoverable and open for joining. */
    GroupReverseDemandDto publishDemand(String leaderEmail, UUID demandId);

    GroupReverseDemandDto getDemand(String requesterEmail, UUID demandId);

    /** Published, joinable demands for the discovery page. */
    List<GroupReverseDemandDto> discoverDemands(String requesterEmail);

    /** Every demand the caller created, as leader. */
    List<GroupReverseDemandDto> getMyLedDemands(String leaderEmail);

    GroupReverseDemandDto cancelDemand(String leaderEmail, UUID demandId, String reason);

    /**
     * Cancels a demand on the platform's behalf, for moderation.
     * <p>
     * Shares the leader's cancellation path so there is exactly one implementation of "void every
     * member's reservation and close the outstanding offers" to keep correct.
     */
    GroupReverseDemandDto cancelByAdmin(UUID demandId, String adminEmail, String reason);

    /** Members of a demand. The leader sees the full list; members see only their own record. */
    List<GroupReverseMemberDto> getMembers(String requesterEmail, UUID demandId);
}
