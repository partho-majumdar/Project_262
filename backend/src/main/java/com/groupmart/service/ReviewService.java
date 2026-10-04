package com.groupmart.service;

import java.util.List;
import java.util.UUID;

import com.groupmart.dto.review.CreateReviewRequest;
import com.groupmart.dto.review.ProductReviewSummaryDto;
import com.groupmart.dto.review.ReviewDto;
import com.groupmart.dto.review.ReviewEligibilityDto;
import com.groupmart.dto.review.SellerReplyRequest;

public interface ReviewService {

    List<ReviewDto> getProductReviews(UUID productId);

    ProductReviewSummaryDto getProductReviewSummary(UUID productId);

    /**
     * Whether this customer may review the product: only a customer with a DELIVERED order
     * containing it, and only until they have reviewed it.
     */
    ReviewEligibilityDto getEligibility(String userEmail, UUID productId);

    /**
     * The same answer for many products at once, so a page of order lines can be marked in a
     * single request instead of one call per item.
     */
    List<ReviewEligibilityDto> getEligibilityForProducts(String userEmail, List<UUID> productIds);

    ReviewDto createReview(String userEmail, UUID productId, CreateReviewRequest request);

    void deleteReview(String userEmail, UUID reviewId);

    ReviewDto voteHelpful(UUID reviewId);

    List<ReviewDto> getSellerProductReviews(String sellerEmail);

    ReviewDto replyToReview(String sellerEmail, UUID reviewId, SellerReplyRequest request);

    List<ReviewDto> getRecentReviews(int limit);
}
