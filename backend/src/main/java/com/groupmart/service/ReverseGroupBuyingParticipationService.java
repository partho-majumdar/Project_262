package com.groupmart.service;

import java.util.List;
import java.util.UUID;

import com.groupmart.dto.reverse.ReverseGroupBuyingParticipationDto;
import com.groupmart.dto.reverse.ReverseGroupBuyingParticipationRequest;

/**
 * Customer side of Reverse Group Buying: contributing demand to an offer independently, withdrawing
 * that demand before the purchasing condition unlocks, and reviewing one's own participations.
 */
public interface ReverseGroupBuyingParticipationService {

    ReverseGroupBuyingParticipationDto participate(String userEmail, UUID offerId,
                                                   ReverseGroupBuyingParticipationRequest request);

    /**
     * Withdraws a participation while the offer is still collecting demand. The quantity is released
     * and the collective demand is recalculated, which can drop the offer back out of its
     * almost-complete state. Once the campaign is activated, individual order rules apply instead.
     */
    ReverseGroupBuyingParticipationDto cancelParticipation(String userEmail, UUID participationId, String reason);

    List<ReverseGroupBuyingParticipationDto> getMyParticipations(String userEmail);
}
