package com.groupmart.service;

import com.groupmart.dto.groupbuy.GroupBuyDisputeDto;
import com.groupmart.dto.groupbuy.GroupBuyDisputeRequest;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Shopper disputes about a group buy participation and their resolution by administrators. */
public interface GroupBuyDisputeService {

    GroupBuyDisputeDto openDispute(String userEmail, UUID groupId, GroupBuyDisputeRequest request);

    List<GroupBuyDisputeDto> getMyDisputes(String userEmail);

    List<GroupBuyDisputeDto> getDisputes(String status);

    GroupBuyDisputeDto getDispute(UUID disputeId);

    GroupBuyDisputeDto startReview(String adminEmail, UUID disputeId, String note);

    GroupBuyDisputeDto resolve(String adminEmail, UUID disputeId, BigDecimal refundAmount, String note);

    GroupBuyDisputeDto reject(String adminEmail, UUID disputeId, String note);
}
