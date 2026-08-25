package com.groupmart.dto.seller;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateSellerStoreRequest {

    @NotBlank(message = "Store name is required")
    private String storeName;

    @NotBlank(message = "Store description is required")
    private String description;

    private String logoUrl;

    private String bannerUrl;

    @NotBlank(message = "Tax ID / Business License is required for verification")
    private String taxId;
}
