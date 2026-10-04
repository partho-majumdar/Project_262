package com.groupmart.dto.groupr;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Editing a demand the leader created.
 * <p>
 * Only a DRAFT demand is editable. Once published, the quantity and deadlines are what other
 * customers have already committed against, so changing them mid-flight would invalidate their
 * decisions; the leader's remaining levers are cancel, or simply let the deadline pass.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateGroupReverseDemandRequest {

    @Size(max = 2000, message = "Description must be at most 2000 characters")
    private String description;

    @DecimalMin(value = "0.01", message = "Target price must be greater than zero")
    private BigDecimal targetPrice;

    @DecimalMin(value = "0.01", message = "Maximum price must be greater than zero")
    private BigDecimal maxPrice;

    @Min(value = 1, message = "Minimum member quantity must be at least 1")
    private Integer minQuantityPerMember;

    @Min(value = 1, message = "Maximum member quantity must be at least 1")
    private Integer maxQuantityPerMember;

    private LocalDateTime joinDeadline;

    private LocalDateTime offerDeadline;

    @Size(max = 100, message = "Delivery city must be at most 100 characters")
    private String deliveryCity;

    private LocalDate requiredDeliveryDate;
}
