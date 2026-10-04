package com.groupmart.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.Order;
import com.groupmart.entity.OrderStatus;
import com.groupmart.entity.OrderType;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<Order, UUID> {

    List<Order> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<Order> findByOrderNumber(String orderNumber);

    /**
     * The order a winning auction produced. At most one can exist per auction, which is exactly what
     * the unique constraint on {@code auction_id} guarantees.
     */
    Optional<Order> findByAuctionId(UUID auctionId);

    boolean existsByOrderNumber(String orderNumber);

    /** Orders that have not arrived yet, used when a delivery rule change re-dates open orders. */
    List<Order> findByStatusIn(Collection<OrderStatus> statuses);

    /** Newest first, for the admin delivery board. */
    List<Order> findByOrderByCreatedAtDesc();

    List<Order> findByOrderTypeOrderByCreatedAtDesc(OrderType orderType);

    /** Revenue actually collected: the total of orders whose payment completed. */
    @org.springframework.data.jpa.repository.Query("SELECT COALESCE(SUM(o.totalAmount), 0) FROM Order o "
            + "WHERE o.paymentStatus = com.groupmart.entity.PaymentStatus.COMPLETED")
    java.math.BigDecimal sumPaidRevenue();

    /**
     * Orders placed inside a span, with the buyer joined in.
     *
     * <p>For the sales-performance rollup. The buyer is fetched explicitly because it is lazy and the
     * rollup needs a distinct-buyer count, which would otherwise be one query per order. Cancelled
     * orders are included on purpose; the caller decides what to do with them.
     */
    @org.springframework.data.jpa.repository.Query("SELECT o FROM Order o JOIN FETCH o.user "
            + "WHERE o.createdAt >= :from AND o.createdAt <= :to ORDER BY o.createdAt")
    List<Order> findForAnalytics(@org.springframework.data.repository.query.Param("from") java.time.LocalDateTime from,
                                 @org.springframework.data.repository.query.Param("to") java.time.LocalDateTime to);

    /**
     * Value and count of non-cancelled orders in a half-open span {@code [from, to)}.
     *
     * <p>Half-open so consecutive spans tile without double counting: the previous period ends where
     * this one starts.
     */
    @org.springframework.data.jpa.repository.Query("SELECT COALESCE(SUM(o.totalAmount), 0) AS gmv, "
            + "COUNT(o) AS orderCount FROM Order o "
            + "WHERE o.status <> com.groupmart.entity.OrderStatus.CANCELLED "
            + "AND o.createdAt >= :from AND o.createdAt < :to")
    com.groupmart.dto.analytics.sales.GmvTotal sumNonCancelledBetween(
            @org.springframework.data.repository.query.Param("from") java.time.LocalDateTime from,
            @org.springframework.data.repository.query.Param("to") java.time.LocalDateTime to);

    /** Value and count of every non-cancelled order ever placed. */
    @org.springframework.data.jpa.repository.Query("SELECT COALESCE(SUM(o.totalAmount), 0) AS gmv, "
            + "COUNT(o) AS orderCount FROM Order o "
            + "WHERE o.status <> com.groupmart.entity.OrderStatus.CANCELLED")
    com.groupmart.dto.analytics.sales.GmvTotal sumNonCancelled();
}
