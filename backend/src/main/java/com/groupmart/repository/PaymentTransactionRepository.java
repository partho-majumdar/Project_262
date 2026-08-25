package com.groupmart.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.groupmart.entity.PaymentTransaction;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, UUID> {

    List<PaymentTransaction> findByOrderIdOrderByCreatedAtDesc(UUID orderId);

    Optional<PaymentTransaction> findByTransactionId(String transactionId);

    boolean existsByTransactionId(String transactionId);
}
