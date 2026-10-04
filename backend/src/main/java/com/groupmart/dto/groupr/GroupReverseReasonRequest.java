package com.groupmart.dto.groupr;

import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupReverseReasonRequest {

    @Size(max = 500, message = "Reason must be at most 500 characters")
    private String reason;
}
