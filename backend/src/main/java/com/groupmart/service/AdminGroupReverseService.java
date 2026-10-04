package com.groupmart.service;

import java.util.List;
import java.util.UUID;

import com.groupmart.dto.groupr.GroupReverseDemandDto;
import com.groupmart.entity.GroupReverseDemandStatus;

/** Administrative moderation of group reverse demands. */
public interface AdminGroupReverseService {

    List<GroupReverseDemandDto> listDemands(GroupReverseDemandStatus status);

    GroupReverseDemandDto getDemand(UUID demandId);

    /**
     * Cancels a demand on the platform's behalf, releasing every member's reserved quantity and
     * closing the outstanding offers.
     */
    GroupReverseDemandDto cancelAsAdmin(UUID demandId, String adminEmail, String reason);
}
