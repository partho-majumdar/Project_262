package com.groupmart.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddressDto {

    private UUID id;
    private String fullName;
    private String phone;
    private String streetAddress;
    private String apartment;
    private String city;
    private String state;
    private String postalCode;
    private String country;
    private String addressType;
    private boolean isDefault;
}
