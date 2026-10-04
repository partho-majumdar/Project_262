package com.groupmart.service;

import com.groupmart.dto.wholesale.WholesaleDisputeDto;
import com.groupmart.dto.wholesale.WholesaleDisputeRequest;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Customer disputes about a converted wholesale reservation's order, and their resolution by
 * administrators (CWP spec section 21). Every dispute is scoped to one reservation/order, so
 * resolving or rejecting it never touches any other participant in the same pool.
 */
public interface WholesaleDisputeService {

    WholesaleDisputeDto openDispute(String userEmail, UUID reservationId, WholesaleDisputeRequest request);

    List<WholesaleDisputeDto> getMyDisputes(String userEmail);

    List<WholesaleDisputeDto> getDisputes(String status);

    WholesaleDisputeDto getDispute(UUID disputeId);

    WholesaleDisputeDto startReview(String adminEmail, UUID disputeId, String note);

    WholesaleDisputeDto resolve(String adminEmail, UUID disputeId, BigDecimal refundAmount, String note);

    WholesaleDisputeDto reject(String adminEmail, UUID disputeId, String note);
}
