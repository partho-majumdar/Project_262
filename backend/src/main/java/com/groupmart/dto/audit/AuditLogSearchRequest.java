package com.groupmart.dto.audit;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogSearchRequest {

    private String query;
    private String userEmail;
    private String action;
    private Integer page;
    private Integer size;
}
