package com.groupmart.dto.seller;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.groupmart.entity.SellerStatus;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SellerReviewDecisionRequest {

    @NotNull(message = "Decision status is required")
    private SellerStatus decision;

    @Size(max = 500, message = "Reason must be at most 500 characters")
    private String reason;
}
