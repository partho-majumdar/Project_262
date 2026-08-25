package com.groupmart.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.review.ProductReviewSummaryDto;
import com.groupmart.dto.review.ReviewDto;
import com.groupmart.service.ReviewService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    @GetMapping("/product/{productId}")
    public ResponseEntity<ApiResponse<List<ReviewDto>>> getProductReviews(@PathVariable UUID productId) {
        List<ReviewDto> reviews = reviewService.getProductReviews(productId);
        return ResponseEntity.ok(ApiResponse.success("Product reviews fetched", reviews));
    }

    @GetMapping("/product/{productId}/summary")
    public ResponseEntity<ApiResponse<ProductReviewSummaryDto>> getProductReviewSummary(@PathVariable UUID productId) {
        ProductReviewSummaryDto summary = reviewService.getProductReviewSummary(productId);
        return ResponseEntity.ok(ApiResponse.success("Product review summary fetched", summary));
    }

    @PostMapping("/{reviewId}/helpful")
    public ResponseEntity<ApiResponse<ReviewDto>> voteHelpful(@PathVariable UUID reviewId) {
        ReviewDto updated = reviewService.voteHelpful(reviewId);
        return ResponseEntity.ok(ApiResponse.success("Voted helpful", updated));
    }
}
