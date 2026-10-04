package com.groupmart.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.Order;
import com.groupmart.entity.OrderItem;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {

    List<OrderItem> findBySellerStoreIdOrderByCreatedAtDesc(UUID sellerStoreId);

    /**
     * The distinct DELIVERED orders a customer holds for one product, newest first.
     * <p>
     * Review eligibility is derived from this: a review is only accepted once the goods actually
     * arrived, so PROCESSING/SHIPPED orders are deliberately excluded.
     */
    @Query("SELECT DISTINCT oi.order FROM OrderItem oi "
            + "WHERE oi.product.id = :productId "
            + "AND oi.order.user.id = :userId "
            + "AND oi.order.status = com.groupmart.entity.OrderStatus.DELIVERED "
            + "ORDER BY oi.order.updatedAt DESC")
    List<Order> findDeliveredOrdersByUserAndProduct(@Param("userId") UUID userId,
                                                    @Param("productId") UUID productId);

    /**
     * Every product this customer has actually received, in one round trip. Used to mark the
     * reviewable items on the orders page without a request per line item.
     */
    @Query("SELECT DISTINCT oi.product.id FROM OrderItem oi "
            + "WHERE oi.order.user.id = :userId "
            + "AND oi.order.status = com.groupmart.entity.OrderStatus.DELIVERED")
    List<UUID> findDeliveredProductIdsByUser(@Param("userId") UUID userId);

    /**
     * Order lines for the sales-performance rollup, flattened with product and category names.
     *
     * <p>Cancelled orders are excluded here rather than in the caller, so the category and product
     * breakdowns cannot accidentally count merchandise that was never paid for. The category name
     * is joined instead of walked: {@code Product.category} is lazy, and reading it per line would
     * mean a query for every line item on the platform.
     */
    @Query("SELECT oi.order.id AS orderId, oi.product.id AS productId, oi.productName AS productName, "
            + "oi.productSku AS sku, oi.quantity AS quantity, oi.subtotal AS subtotal, "
            + "COALESCE(oi.product.category.name, 'Uncategorized') AS categoryName "
            + "FROM OrderItem oi "
            + "WHERE oi.order.status <> com.groupmart.entity.OrderStatus.CANCELLED "
            + "AND oi.order.createdAt >= :from AND oi.order.createdAt <= :to")
    List<com.groupmart.dto.analytics.sales.OrderItemFact> findItemFactsForAnalytics(
            @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}
