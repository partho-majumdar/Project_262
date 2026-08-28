package com.groupmart.dto.review;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SellerReplyRequest {

    @NotBlank(message = "Reply text is required")
    private String reply;
}
