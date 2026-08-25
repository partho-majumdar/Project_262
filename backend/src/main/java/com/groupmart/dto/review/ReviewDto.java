package com.groupmart.dto.review;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewDto {

    private UUID id;
    private UUID productId;
    private UUID userId;
    private String userName;
    private String userAvatar;
    private int rating;
    private String title;
    private String comment;
    private boolean verifiedPurchase;
    private int helpfulVotes;
    private LocalDateTime createdAt;
}
