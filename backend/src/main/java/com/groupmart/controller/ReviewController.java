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
import com.groupmart.dto.review.ReviewEligibilityDto;
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

    /**
     * Whether the signed-in customer may review this product. Reviews require a delivered order, so
     * the product page asks this instead of offering a form that the server would reject.
     */
    @GetMapping("/product/{productId}/eligibility")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<ReviewEligibilityDto>> getReviewEligibility(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID productId) {
        ReviewEligibilityDto eligibility = reviewService.getEligibility(userDetails.getUsername(), productId);
        return ResponseEntity.ok(ApiResponse.success("Review eligibility fetched", eligibility));
    }

    /** Batch form of the endpoint above, for marking a page of delivered order lines. */
    @GetMapping("/eligibility")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<ReviewEligibilityDto>>> getReviewEligibilityBatch(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam List<UUID> productIds) {
        List<ReviewEligibilityDto> results =
                reviewService.getEligibilityForProducts(userDetails.getUsername(), productIds);
        return ResponseEntity.ok(ApiResponse.success("Review eligibility fetched", results));
    }

    @GetMapping("/recent")
    public ResponseEntity<ApiResponse<List<ReviewDto>>> getRecentReviews() {
        List<ReviewDto> reviews = reviewService.getRecentReviews(6);
        return ResponseEntity.ok(ApiResponse.success("Recent reviews fetched", reviews));
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
