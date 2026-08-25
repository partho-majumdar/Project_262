package com.groupmart.service;

import java.util.List;
import java.util.UUID;

import com.groupmart.dto.review.CreateReviewRequest;
import com.groupmart.dto.review.ProductReviewSummaryDto;
import com.groupmart.dto.review.ReviewDto;

public interface ReviewService {

    List<ReviewDto> getProductReviews(UUID productId);

    ProductReviewSummaryDto getProductReviewSummary(UUID productId);

    ReviewDto createReview(String userEmail, UUID productId, CreateReviewRequest request);

    void deleteReview(String userEmail, UUID reviewId);

    ReviewDto voteHelpful(UUID reviewId);
}
