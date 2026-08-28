package com.groupmart.controller;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.review.ReviewDto;
import com.groupmart.dto.review.SellerReplyRequest;
import com.groupmart.service.ReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/seller/reviews")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SELLER', 'ADMIN')")
public class SellerReviewController {

    private final ReviewService reviewService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ReviewDto>>> getMyProductReviews(
            @AuthenticationPrincipal UserDetails userDetails) {
        List<ReviewDto> reviews = reviewService.getSellerProductReviews(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Seller product reviews retrieved", reviews));
    }

    @PostMapping("/{id}/reply")
    public ResponseEntity<ApiResponse<ReviewDto>> replyToReview(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID id,
            @Valid @RequestBody SellerReplyRequest request) {
        ReviewDto updated = reviewService.replyToReview(userDetails.getUsername(), id, request);
        return ResponseEntity.ok(ApiResponse.success("Reply saved", updated));
    }
}
