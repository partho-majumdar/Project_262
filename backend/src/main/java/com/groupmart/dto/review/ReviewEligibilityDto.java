package com.groupmart.dto.review;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Whether the current customer may review a product, and why not when they cannot.
 * <p>
 * Reviews are earned by delivery: only a customer with a DELIVERED order containing the product is
 * eligible. The product page uses this to explain the rule instead of showing a form that would be
 * rejected.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewEligibilityDto {

    private UUID productId;

    /** True only when the customer received this product and has not already reviewed it. */
    private boolean eligible;

    /** Human-readable explanation shown to the customer; null when eligible. */
    private String reason;

    /** The delivered order that grants eligibility, when there is one. */
    private String orderNumber;
    private LocalDateTime deliveredAt;

    /** Set when the customer already reviewed this product. */
    private UUID existingReviewId;
}
