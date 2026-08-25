package com.groupmart.dto.cart;

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
public class CartDto {

    private UUID id;
    private List<CartItemDto> items;
    private int totalItems;
    private BigDecimal subtotalAmount;
    private BigDecimal estimatedTax;
    private BigDecimal shippingAmount;
    private BigDecimal totalAmount;
}
