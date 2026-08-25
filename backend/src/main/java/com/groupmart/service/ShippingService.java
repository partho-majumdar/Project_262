package com.groupmart.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import com.groupmart.dto.shipping.ShippingOptionDto;

public interface ShippingService {

    List<ShippingOptionDto> getAvailableShippingMethods(String userEmail, UUID addressId, BigDecimal subtotal);
}
