package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.shipping.ShippingOptionDto;
import com.groupmart.entity.Address;
import com.groupmart.entity.User;
import com.groupmart.repository.AddressRepository;
import com.groupmart.repository.UserRepository;
import com.groupmart.service.ShippingService;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ShippingServiceImpl implements ShippingService {

    private final AddressRepository addressRepository;
    private final UserRepository userRepository;

    private static final BigDecimal FREE_SHIPPING_THRESHOLD = new BigDecimal("100.00");

    @Override
    public List<ShippingOptionDto> getAvailableShippingMethods(String userEmail, UUID addressId, BigDecimal subtotal) {
        BigDecimal orderSubtotal = subtotal != null ? subtotal : BigDecimal.ZERO;
        boolean qualifiesForFreeShipping = orderSubtotal.compareTo(FREE_SHIPPING_THRESHOLD) >= 0;

        List<ShippingOptionDto> options = new ArrayList<>();

        // Standard Ground Shipping
        BigDecimal standardRate = qualifiesForFreeShipping ? BigDecimal.ZERO : new BigDecimal("15.00");
        options.add(ShippingOptionDto.builder()
                .id("STD_GROUND")
                .carrier("Nexus Logistics Express")
                .name("Standard Ground Shipping")
                .estimatedDelivery("3-5 Business Days")
                .rate(standardRate)
                .isFree(qualifiesForFreeShipping)
                .build());

        // Priority Express Shipping
        options.add(ShippingOptionDto.builder()
                .id("PRIORITY_EXPRESS")
                .carrier("FedEx Air Priority")
                .name("Priority Air Express")
                .estimatedDelivery("1-2 Business Days")
                .rate(new BigDecimal("29.99"))
                .isFree(false)
                .build());

        // Same-Day / Overnight Courier
        options.add(ShippingOptionDto.builder()
                .id("OVERNIGHT_COURIER")
                .carrier("DHL Worldwide Courier")
                .name("Next-Day Premium Courier")
                .estimatedDelivery("1 Business Day")
                .rate(new BigDecimal("49.99"))
                .isFree(false)
                .build());

        return options;
    }
}
