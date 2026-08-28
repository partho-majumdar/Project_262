package com.groupmart.service;

import com.groupmart.dto.wallet.PayoutRequestDto;
import com.groupmart.dto.wallet.SellerWalletDto;

import java.math.BigDecimal;
import java.util.UUID;

public interface WalletService {

    SellerWalletDto getWallet(String sellerEmail);

    SellerWalletDto requestPayout(String sellerEmail, PayoutRequestDto request);

    void creditFromOrder(UUID sellerStoreId, BigDecimal grossAmount, String orderNumber);
}
