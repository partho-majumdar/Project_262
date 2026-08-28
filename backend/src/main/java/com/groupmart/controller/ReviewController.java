package com.groupmart.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.review.ProductReviewSummaryDto;
import com.groupmart.dto.review.ReviewDto;
import com.groupmart.dto.review.SellerReplyRequest;
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

    /** Seller: all reviews across own products */
    @GetMapping("/seller/me")
    @PreAuthorize("hasAnyRole('SELLER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<ReviewDto>>> getMyProductReviews(
            @AuthenticationPrincipal UserDetails userDetails) {
        List<ReviewDto> reviews = reviewService.getSellerProductReviews(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Seller product reviews fetched", reviews));
    }

    /** Seller: reply to a review on own product */
    @PostMapping("/{reviewId}/seller-reply")
    @PreAuthorize("hasAnyRole('SELLER', 'ADMIN')")
    public ResponseEntity<ApiResponse<ReviewDto>> sellerReply(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID reviewId,
            @Valid @RequestBody SellerReplyRequest request) {
        ReviewDto updated = reviewService.replyToReview(
                userDetails.getUsername(), reviewId, request);
        return ResponseEntity.ok(ApiResponse.success("Reply saved", updated));
    }
}
