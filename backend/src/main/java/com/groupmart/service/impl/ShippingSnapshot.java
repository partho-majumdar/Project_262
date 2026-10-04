package com.groupmart.service.impl;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

import com.groupmart.entity.Address;

/**
 * The shipping address a collective purchasing mechanism copies onto each individual order, so the
 * order keeps working with the existing delivery/tracking system exactly as it does for a normal
 * checkout.
 */
public record ShippingSnapshot(String line1, String line2, String city, String state,
                               String postalCode, String country) {

    public static ShippingSnapshot of(Address address) {
        return new ShippingSnapshot(
                address.getStreetAddress(),
                address.getApartment(),
                address.getCity(),
                address.getState(),
                address.getPostalCode(),
                address.getCountry());
    }
}
