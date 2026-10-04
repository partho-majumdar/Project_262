package com.groupmart.dto.groupbuy;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import com.groupmart.entity.GroupBuyDisputeType;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupBuyDisputeRequest {

    @NotNull(message = "Choose what went wrong")
    private GroupBuyDisputeType type;

    @NotBlank(message = "Describe the problem")
    @Size(min = 10, max = 2000, message = "Description must be between 10 and 2000 characters")
    private String description;
}
