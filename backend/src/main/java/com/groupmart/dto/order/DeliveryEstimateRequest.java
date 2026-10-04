package com.groupmart.dto.order;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** An administrator's delivery date for one order, or a request to go back to the automatic rule. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeliveryEstimateRequest {

    private LocalDateTime estimatedDeliveryAt;

    @Size(max = 200, message = "The note must be at most 200 characters")
    private String note;

    /** When true the date is recalculated from the platform rule and the note is cleared. */
    private boolean resetToAutomatic;
}
