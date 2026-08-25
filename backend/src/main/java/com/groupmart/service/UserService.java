package com.groupmart.service;

import java.util.List;
import java.util.UUID;

import com.groupmart.dto.auth.UserDto;
import com.groupmart.dto.user.*;

public interface UserService {

    UserDto getProfile(String email);

    UserDto updateProfile(String email, UpdateProfileRequest request);

    void changePassword(String email, ChangePasswordRequest request);

    List<AddressDto> getUserAddresses(String email);

    AddressDto addAddress(String email, CreateAddressRequest request);

    AddressDto updateAddress(String email, UUID addressId, UpdateAddressRequest request);

    void deleteAddress(String email, UUID addressId);

    AddressDto setDefaultAddress(String email, UUID addressId);
}
