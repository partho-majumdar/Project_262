package com.groupmart.dto.product;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateProductRequest {

    @NotBlank(message = "Product name is required")
    private String name;

    @NotNull(message = "Price is required")
    @Min(value = 0, message = "Price cannot be negative")
    private BigDecimal price;

    private BigDecimal compareAtPrice;

    @NotNull(message = "Category is required")
    private UUID categoryId;

    @Min(value = 0, message = "Stock quantity cannot be negative")
    @Builder.Default
    private int stockQuantity = 0;

    private String description;

    private List<String> imageUrls;

    @Builder.Default
    private boolean featured = false;
}
