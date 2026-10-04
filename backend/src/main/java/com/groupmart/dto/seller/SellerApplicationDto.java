package com.groupmart.dto.seller;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.groupmart.entity.SellerStatus;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SellerApplicationDto {

    private UUID userId;
    private String email;
    private String firstName;
    private String lastName;
    private String phone;
    private SellerStatus sellerStatus;
    private String sellerStatusReason;
    private LocalDateTime sellerReviewedAt;
    private LocalDateTime submittedAt;
    private SellerStoreDto store;
}
