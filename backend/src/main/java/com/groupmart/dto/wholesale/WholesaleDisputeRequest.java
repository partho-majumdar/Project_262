package com.groupmart.dto.wholesale;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.groupmart.entity.WholesaleDisputeType;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WholesaleDisputeRequest {

    @NotNull(message = "Choose what went wrong")
    private WholesaleDisputeType type;

    @NotBlank(message = "Describe the problem")
    @Size(min = 10, max = 2000, message = "Description must be between 10 and 2000 characters")
    private String description;
}
