package com.groupmart.dto.inventory;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateStockRequest {

    private int quantityChange; // Positive for restock, negative for deduction

    @NotBlank(message = "Reason for stock adjustment is required")
    private String reason; // RESTOCK, MANUAL_ADJUSTMENT, DAMAGE_WRITE_OFF

    private String referenceId;
}
