package com.groupmart.dto.wallet;

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
public class SellerWalletDto {

    private UUID id;
    private BigDecimal availableBalance;
    private BigDecimal pendingBalance;
    private BigDecimal totalEarned;
    private BigDecimal totalPaidOut;
    private BigDecimal grossSales;
    private BigDecimal estimatedNet;
    private List<WalletTransactionDto> recentTransactions;
}

