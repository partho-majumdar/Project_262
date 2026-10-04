package com.groupmart.dto.groupr;

import java.util.UUID;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A customer joining somebody else's group demand.
 * <p>
 * The address is mandatory and is snapshotted onto the membership: members of one group routinely
 * ship to different cities, so a group delivery city is a preference for the sellers, not a shared
 * destination.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JoinGroupReverseDemandRequest {

    @NotNull(message = "Quantity is required")
    @Min(value = 1, message = "Quantity must be at least 1")
    private Integer quantity;

    @NotNull(message = "Shipping address is required")
    private UUID addressId;

    @NotNull(message = "Payment method is required")
    private String paymentMethod;

    @Size(max = 500, message = "Note must be at most 500 characters")
    private String note;
}
