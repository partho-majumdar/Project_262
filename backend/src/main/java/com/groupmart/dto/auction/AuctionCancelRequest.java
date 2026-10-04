package com.groupmart.dto.auction;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Optional reason recorded when a seller or admin withdraws an auction. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuctionCancelRequest {

    @Size(max = 500, message = "Reason must be at most 500 characters")
    private String reason;
}
