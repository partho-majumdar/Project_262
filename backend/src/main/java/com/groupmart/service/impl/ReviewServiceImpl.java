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
import com.groupmart.dto.review.ReviewEligibilityDto;
import com.groupmart.dto.review.SellerReplyRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.ReviewService;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReviewServiceImpl implements ReviewService {

    private final ReviewRepository reviewRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final OrderItemRepository orderItemRepository;
    private final SellerStoreRepository sellerStoreRepository;

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
        productRepository.findById(productId)
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
    @Transactional(readOnly = true)
    public ReviewEligibilityDto getEligibility(String userEmail, UUID productId) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", productId));

        Order delivered = firstDeliveredOrder(user.getId(), productId);
        Review existing = reviewRepository.findByUserIdAndProductId(user.getId(), productId).orElse(null);

        if (existing != null) {
            return ReviewEligibilityDto.builder()
                    .productId(productId)
                    .eligible(false)
                    .reason("You have already reviewed this product.")
                    .existingReviewId(existing.getId())
                    .orderNumber(delivered != null ? delivered.getOrderNumber() : null)
                    .deliveredAt(delivered != null ? delivered.getDeliveredAt() : null)
                    .build();
        }

        if (delivered == null) {
            return ReviewEligibilityDto.builder()
                    .productId(productId)
                    .eligible(false)
                    .reason("Only customers whose order for this product has been delivered can review it.")
                    .build();
        }

        return ReviewEligibilityDto.builder()
                .productId(productId)
                .eligible(true)
                .orderNumber(delivered.getOrderNumber())
                .deliveredAt(delivered.getDeliveredAt())
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

        // A review is earned by delivery, so an order for the product has to have actually arrived.
        // PROCESSING and SHIPPED do not qualify, and neither does never having bought it.
        Order delivered = firstDeliveredOrder(user.getId(), productId);
        if (delivered == null) {
            throw new ApiException(
                    "You can only review a product after your order for it has been delivered",
                    HttpStatus.FORBIDDEN);
        }

        Review review = Review.builder()
                .user(user)
                .product(product)
                .rating(request.getRating())
                .title(request.getTitle().trim())
                .comment(request.getComment())
                .verifiedPurchase(true)
                .helpfulVotes(0)
                .build();

        Review savedReview = reviewRepository.save(review);
        recalculateProductRating(product);

        return mapToDto(savedReview);
    }

    /** Newest DELIVERED order this customer holds for the product, or null. */
    private Order firstDeliveredOrder(UUID userId, UUID productId) {
        List<Order> delivered = orderItemRepository.findDeliveredOrdersByUserAndProduct(userId, productId);
        return delivered.isEmpty() ? null : delivered.get(0);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReviewEligibilityDto> getEligibilityForProducts(String userEmail, List<UUID> productIds) {
        if (productIds == null || productIds.isEmpty()) {
            return List.of();
        }

        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        // One query each, then the per-product answer is derived in memory.
        Set<UUID> delivered = new HashSet<>(orderItemRepository.findDeliveredProductIdsByUser(user.getId()));
        Set<UUID> alreadyReviewed = reviewRepository.findByUserIdAndProductIdIn(user.getId(), productIds)
                .stream()
                .map(r -> r.getProduct().getId())
                .collect(Collectors.toSet());

        return productIds.stream().distinct().map(productId -> {
            if (alreadyReviewed.contains(productId)) {
                return ReviewEligibilityDto.builder()
                        .productId(productId)
                        .eligible(false)
                        .reason("You have already reviewed this product.")
                        .build();
            }
            if (!delivered.contains(productId)) {
                return ReviewEligibilityDto.builder()
                        .productId(productId)
                        .eligible(false)
                        .reason("Only customers whose order for this product has been delivered can review it.")
                        .build();
            }
            return ReviewEligibilityDto.builder()
                    .productId(productId)
                    .eligible(true)
                    .build();
        }).collect(Collectors.toList());
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

    @Override
    @Transactional(readOnly = true)
    public List<ReviewDto> getSellerProductReviews(String sellerEmail) {
        User user = userRepository.findByEmail(sellerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", sellerEmail));

        SellerStore store = sellerStoreRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("SellerStore", "userId", user.getId()));

        return reviewRepository.findBySellerStoreId(store.getId()).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ReviewDto replyToReview(String sellerEmail, UUID reviewId, SellerReplyRequest request) {
        User user = userRepository.findByEmail(sellerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", sellerEmail));

        SellerStore store = sellerStoreRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("SellerStore", "userId", user.getId()));

        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Review", "id", reviewId));

        if (review.getProduct().getSellerStore() == null
                || !review.getProduct().getSellerStore().getId().equals(store.getId())) {
            throw new ApiException("You can only reply to reviews on your own products", HttpStatus.FORBIDDEN);
        }

        review.setSellerReply(request.getReply().trim());
        review.setSellerRepliedAt(LocalDateTime.now());

        Review updated = reviewRepository.save(review);
        return mapToDto(updated);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReviewDto> getRecentReviews(int limit) {
        return reviewRepository.findTop8ByOrderByCreatedAtDesc().stream()
                .map(this::mapToDto)
                .limit(limit)
                .collect(Collectors.toList());
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
                .productName(review.getProduct() != null ? review.getProduct().getName() : null)
                .userId(review.getUser().getId())
                .userName(review.getUser().getFirstName() + " " + review.getUser().getLastName())
                .userAvatar(review.getUser().getAvatarUrl())
                .rating(review.getRating())
                .title(review.getTitle())
                .comment(review.getComment())
                .verifiedPurchase(review.isVerifiedPurchase())
                .helpfulVotes(review.getHelpfulVotes())
                .sellerReply(review.getSellerReply())
                .sellerRepliedAt(review.getSellerRepliedAt())
                .createdAt(review.getCreatedAt())
                .build();
        }
}
