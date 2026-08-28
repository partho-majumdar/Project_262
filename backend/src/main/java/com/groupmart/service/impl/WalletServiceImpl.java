package com.groupmart.service.impl;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.wallet.PayoutRequestDto;
import com.groupmart.dto.wallet.SellerWalletDto;
import com.groupmart.dto.wallet.WalletTransactionDto;
import com.groupmart.entity.*;
import com.groupmart.repository.OrderItemRepository;
import com.groupmart.repository.SellerStoreRepository;
import com.groupmart.repository.SellerWalletRepository;
import com.groupmart.repository.UserRepository;
import com.groupmart.repository.WalletTransactionRepository;
import com.groupmart.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WalletServiceImpl implements WalletService {

    private final SellerWalletRepository walletRepository;
    private final WalletTransactionRepository transactionRepository;
    private final SellerStoreRepository sellerStoreRepository;
    private final UserRepository userRepository;
    private final OrderItemRepository orderItemRepository;

    private static final BigDecimal PLATFORM_FEE_RATE = new BigDecimal("0.15");

    @Override
    @Transactional(readOnly = true)
    public SellerWalletDto getWallet(String sellerEmail) {
        SellerStore store = getStoreByEmail(sellerEmail);
        SellerWallet wallet = getOrCreateWallet(store);

        List<OrderItem> items = orderItemRepository.findBySellerStoreIdOrderByCreatedAtDesc(store.getId());
        BigDecimal gross = items.stream()
                .map(i -> i.getSubtotal() != null ? i.getSubtotal() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal estimatedNet = gross
                .multiply(BigDecimal.ONE.subtract(PLATFORM_FEE_RATE))
                .setScale(2, RoundingMode.HALF_UP);

        List<WalletTransactionDto> recent = transactionRepository
                .findBySellerStoreIdOrderByCreatedAtDesc(store.getId())
                .stream()
                .limit(30)
                .map(this::mapTx)
                .collect(Collectors.toList());

        return SellerWalletDto.builder()
                .id(wallet.getId())
                .availableBalance(wallet.getAvailableBalance())
                .pendingBalance(wallet.getPendingBalance())
                .totalEarned(wallet.getTotalEarned())
                .totalPaidOut(wallet.getTotalPaidOut())
                .grossSales(gross)
                .estimatedNet(estimatedNet)
                .recentTransactions(recent)
                .build();
    }

    @Override
    @Transactional
    public SellerWalletDto requestPayout(String sellerEmail, PayoutRequestDto request) {
        SellerStore store = getStoreByEmail(sellerEmail);
        SellerWallet wallet = getOrCreateWallet(store);

        BigDecimal amount = request.getAmount().setScale(2, RoundingMode.HALF_UP);

        if (wallet.getAvailableBalance().compareTo(amount) < 0) {
            throw new ApiException("Insufficient available balance", HttpStatus.BAD_REQUEST);
        }

        wallet.setAvailableBalance(wallet.getAvailableBalance().subtract(amount));
        wallet.setPendingBalance(wallet.getPendingBalance().add(amount));
        walletRepository.save(wallet);

        transactionRepository.save(WalletTransaction.builder()
                .sellerStore(store)
                .type(WalletTxType.PAYOUT_REQUEST)
                .amount(amount)
                .description("Payout request")
                .status(WalletTxStatus.PENDING)
                .build());

        return getWallet(sellerEmail);
    }

    @Override
    @Transactional
    public void creditFromOrder(UUID sellerStoreId, BigDecimal grossAmount, String orderNumber) {
        if (grossAmount == null || grossAmount.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        SellerStore store = sellerStoreRepository.findById(sellerStoreId)
                .orElseThrow(() -> new ResourceNotFoundException("SellerStore", "id", sellerStoreId));

        SellerWallet wallet = getOrCreateWallet(store);

        BigDecimal net = grossAmount
                .multiply(BigDecimal.ONE.subtract(PLATFORM_FEE_RATE))
                .setScale(2, RoundingMode.HALF_UP);

        wallet.setAvailableBalance(wallet.getAvailableBalance().add(net));
        wallet.setTotalEarned(wallet.getTotalEarned().add(net));
        walletRepository.save(wallet);

        transactionRepository.save(WalletTransaction.builder()
                .sellerStore(store)
                .type(WalletTxType.CREDIT)
                .amount(net)
                .description("Order credit after 15% platform fee")
                .referenceId(orderNumber)
                .status(WalletTxStatus.COMPLETED)
                .build());
    }

    private SellerStore getStoreByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
        return sellerStoreRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("SellerStore", "userId", user.getId()));
    }

    private SellerWallet getOrCreateWallet(SellerStore store) {
        return walletRepository.findBySellerStoreId(store.getId())
                .orElseGet(() -> walletRepository.save(
                        SellerWallet.builder()
                                .sellerStore(store)
                                .availableBalance(BigDecimal.ZERO)
                                .pendingBalance(BigDecimal.ZERO)
                                .totalEarned(BigDecimal.ZERO)
                                .totalPaidOut(BigDecimal.ZERO)
                                .build()
                ));
    }

    private WalletTransactionDto mapTx(WalletTransaction tx) {
        return WalletTransactionDto.builder()
                .id(tx.getId())
                .type(tx.getType() != null ? tx.getType().name() : null)
                .amount(tx.getAmount())
                .description(tx.getDescription())
                .referenceId(tx.getReferenceId())
                .status(tx.getStatus() != null ? tx.getStatus().name() : null)
                .createdAt(tx.getCreatedAt())
                .build();
    }
}

