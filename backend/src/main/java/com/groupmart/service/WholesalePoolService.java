package com.groupmart.service;

import com.groupmart.dto.order.OrderDto;
import com.groupmart.dto.wholesale.ReserveWholesaleQuantityRequest;
import com.groupmart.dto.wholesale.WholesalePoolDto;
import com.groupmart.dto.wholesale.WholesaleReservationDto;
import com.groupmart.entity.WholesaleOffer;

import java.util.List;
import java.util.UUID;

/**
 * The CWP pool engine: opening lots against an offer and accepting reservations against a lot's
 * shared quantity pool (CWP spec sections 5-7). {@link #reserveQuantity} is the concurrency-critical
 * path - it must run inside one transaction that row-locks the pool so pooledQuantity can never be
 * pushed past lotCapacity by two simultaneous reservations (spec section 15).
 */
public interface WholesalePoolService {

    /** Opens a new lot for the offer at its current max available quantity. Offer must already be locked by the caller. */
    WholesalePoolDto openPoolForOffer(WholesaleOffer offer);

    WholesalePoolDto getPool(UUID poolId);

    List<WholesalePoolDto> getPoolsForOffer(UUID offerId);

    List<WholesalePoolDto> getMarketplacePools();

    /** Accepts a customer's reservation against a pool, transitioning the pool's status as it fills. */
    WholesaleReservationDto reserveQuantity(String userEmail, UUID poolId, ReserveWholesaleQuantityRequest request);

    List<WholesaleReservationDto> getMyReservations(String userEmail);

    /**
     * Cancels a customer's own reservation (CWP spec section 12). Before the pool completes, the
     * quantity is released back to the pool for other customers to reserve. Once the pool has
     * completed, the reservation has its own order and must be cancelled through the normal order
     * cancellation flow instead.
     */
    WholesaleReservationDto cancelReservation(String userEmail, UUID reservationId, String reason);

    /**
     * Ends a pool that reached its reservation deadline without hitting the wholesale minimum
     * (CWP spec section 13): stops new reservations, refunds every active reservation, releases
     * the lot's full reserved inventory back to the product, and notifies everyone involved.
     * Safe to call on a pool that no longer qualifies (already completed/closed) - it is then a no-op.
     */
    void failExpiredPool(UUID poolId);

    /**
     * The orders a completed lot produced, for the seller to fulfil from the lot view. Scoped to the
     * seller's own store; each order is changed through the normal seller order flow
     * (PUT /api/v1/seller/orders/{orderNumber}/status).
     */
    List<OrderDto> getPoolOrders(String sellerEmail, UUID poolId);
}
