package com.groupmart.dto.review;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductReviewSummaryDto {

    private UUID productId;
    private double averageRating;
    private int totalReviews;
    private Map<Integer, Integer> ratingCounts; // Star 5 -> Count, Star 4 -> Count...
}
