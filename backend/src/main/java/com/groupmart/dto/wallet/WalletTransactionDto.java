package com.groupmart.dto.wallet;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WalletTransactionDto {

    private UUID id;
    private String type;
    private BigDecimal amount;
    private String description;
    private String referenceId;
    private String status;
    private LocalDateTime createdAt;
}
