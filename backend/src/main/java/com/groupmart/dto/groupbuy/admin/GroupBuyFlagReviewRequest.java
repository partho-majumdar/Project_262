package com.groupmart.dto.groupbuy.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import com.groupmart.entity.GroupBuyFlagReview;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuyFlagReviewRequest {

    @NotBlank(message = "Flag key is required")
    @Size(max = 200)
    private String key;

    @NotNull(message = "Decision is required")
    private GroupBuyFlagReview.Decision decision;

    @Size(max = 500, message = "Note must be at most 500 characters")
    private String note;
}
