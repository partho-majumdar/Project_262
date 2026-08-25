package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.review.CreateReviewRequest;
import com.groupmart.dto.review.ProductReviewSummaryDto;
import com.groupmart.dto.review.ReviewDto;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.ReviewService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReviewServiceImpl implements ReviewService {

    private final ReviewRepository reviewRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;

    @Override
    @Transactional(readOnly = true)
    public List<ReviewDto> getProductReviews(UUID productId) {
        return reviewRepository.findByProductIdOrderByCreatedAtDesc(productId).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ProductReviewSummaryDto getProductReviewSummary(UUID productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", productId));

        Double avgRating = reviewRepository.getAverageRatingByProductId(productId);
        int totalReviews = reviewRepository.countByProductId(productId);

        Map<Integer, Integer> breakdown = new HashMap<>();
        for (int star = 1; star <= 5; star++) {
            breakdown.put(star, reviewRepository.countByProductIdAndRating(productId, star));
        }

        return ProductReviewSummaryDto.builder()
                .productId(productId)
                .averageRating(avgRating != null ? Math.round(avgRating * 10.0) / 10.0 : 0.0)
                .totalReviews(totalReviews)
                .ratingCounts(breakdown)
                .build();
    }

    @Override
    @Transactional
    public ReviewDto createReview(String userEmail, UUID productId, CreateReviewRequest request) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", productId));

        if (reviewRepository.existsByUserIdAndProductId(user.getId(), productId)) {
            throw new ApiException("You have already submitted a review for this product", HttpStatus.CONFLICT);
        }

        // Verify if customer has purchased and received this product
        boolean isVerifiedBuyer = orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .filter(o -> o.getStatus() == OrderStatus.DELIVERED || o.getStatus() == OrderStatus.PROCESSING || o.getStatus() == OrderStatus.SHIPPED)
                .flatMap(o -> o.getItems().stream())
                .anyMatch(i -> i.getProduct().getId().equals(productId));

        Review review = Review.builder()
                .user(user)
                .product(product)
                .rating(request.getRating())
                .title(request.getTitle().trim())
                .comment(request.getComment())
                .verifiedPurchase(isVerifiedBuyer)
                .helpfulVotes(0)
                .build();

        Review savedReview = reviewRepository.save(review);

        // Update product average rating & review count
        recalculateProductRating(product);

        return mapToDto(savedReview);
    }

    @Override
    @Transactional
    public void deleteReview(String userEmail, UUID reviewId) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Review", "id", reviewId));

        if (user.getRole() != Role.ROLE_ADMIN && !review.getUser().getId().equals(user.getId())) {
            throw new ApiException("You are not authorized to delete this review", HttpStatus.FORBIDDEN);
        }

        Product product = review.getProduct();
        reviewRepository.delete(review);

        recalculateProductRating(product);
    }

    @Override
    @Transactional
    public ReviewDto voteHelpful(UUID reviewId) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Review", "id", reviewId));

        review.setHelpfulVotes(review.getHelpfulVotes() + 1);
        Review updated = reviewRepository.save(review);
        return mapToDto(updated);
    }

    private void recalculateProductRating(Product product) {
        Double newAvg = reviewRepository.getAverageRatingByProductId(product.getId());
        int count = reviewRepository.countByProductId(product.getId());

        product.setRating(newAvg != null ? Math.round(newAvg * 10.0) / 10.0 : 0.0);
        product.setReviewCount(count);
        productRepository.save(product);
    }

    private ReviewDto mapToDto(Review review) {
        return ReviewDto.builder()
                .id(review.getId())
                .productId(review.getProduct().getId())
                .userId(review.getUser().getId())
                .userName(review.getUser().getFirstName() + " " + review.getUser().getLastName())
                .userAvatar(review.getUser().getAvatarUrl())
                .rating(review.getRating())
                .title(review.getTitle())
                .comment(review.getComment())
                .verifiedPurchase(review.isVerifiedPurchase())
                .helpfulVotes(review.getHelpfulVotes())
                .createdAt(review.getCreatedAt())
                .build();
    }
}
