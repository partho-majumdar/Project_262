package com.groupmart.dto.auction;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuctionReasonRequest {

    @Size(max = 500, message = "Reason must be at most 500 characters")
    private String reason;
}
