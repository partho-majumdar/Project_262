package com.groupmart.service;

import java.util.List;
import java.util.UUID;

import com.groupmart.dto.groupr.GroupReverseMemberDto;
import com.groupmart.dto.groupr.JoinGroupReverseDemandRequest;

/** Joining, leaving and tracking group reverse demands. */
public interface GroupReverseParticipationService {

    /**
     * Joins an OPEN demand, atomically reserving the requested quantity against the group target.
     *
     * @return the caller's own membership, with their own maximum and their committed figure
     */
    GroupReverseMemberDto joinDemand(String customerEmail, UUID demandId, JoinGroupReverseDemandRequest request);

    /**
     * Withdraws from a demand, releasing the quantity back to the group.
     * <p>
     * Only allowed while the demand is still open and no offer has been selected. Afterwards the
     * group is committed and the member's exit is an ordinary order cancellation.
     */
    GroupReverseMemberDto leaveDemand(String customerEmail, UUID demandId, String reason);

    /** The caller's own membership in a demand, or null when they are not a member. */
    GroupReverseMemberDto getMyMembership(String customerEmail, UUID demandId);

    /** Every demand the caller has joined under somebody else's leadership. */
    /**
     * The group demands this customer joined under somebody else's leadership, in the same shape as
     * {@code getMyLedDemands} so a client can render both from one card. The groups this customer
     * leads are not repeated here - they belong to the led list.
     */
    List<com.groupmart.dto.groupr.GroupReverseDemandDto> getMyJoinedDemands(String customerEmail);
}
