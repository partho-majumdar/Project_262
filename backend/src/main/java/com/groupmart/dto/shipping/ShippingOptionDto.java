package com.groupmart.dto.shipping;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShippingOptionDto {

    private String id;
    private String carrier;
    private String name;
    private String estimatedDelivery;
    private BigDecimal rate;
    private boolean isFree;
}
