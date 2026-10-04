package com.groupmart.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SellerApplicationRequest {

    @NotBlank(message = "Store name is required")
    @Size(max = 150, message = "Store name must be at most 150 characters")
    private String storeName;

    @NotBlank(message = "Store description is required")
    @Size(max = 1500, message = "Store description must be at most 1500 characters")
    private String description;

    @NotBlank(message = "Tax ID / business registration number is required")
    @Size(max = 100, message = "Tax ID must be at most 100 characters")
    private String taxId;

    private String logoUrl;
    private String bannerUrl;
    private String bankAccount;
    private String bankName;
}
