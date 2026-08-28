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
public class UpdateSellerStoreRequest {

    @NotBlank(message = "Store name is required")
    private String storeName;

    private String description;

    private String logoUrl;

    private String bannerUrl;

    private String taxId;

    private String bankAccount;

    private String bankName;

    private String shippingPolicy;

    private String returnPolicy;
}

