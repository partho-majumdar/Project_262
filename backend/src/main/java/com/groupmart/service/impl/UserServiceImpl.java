package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.auth.UserDto;
import com.groupmart.dto.user.*;
import com.groupmart.entity.Address;
import com.groupmart.entity.User;
import com.groupmart.repository.AddressRepository;
import com.groupmart.repository.UserRepository;
import com.groupmart.service.UserService;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final AddressRepository addressRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional(readOnly = true)
    public UserDto getProfile(String email) {
        User user = findUserByEmail(email);
        return mapToUserDto(user);
    }

    @Override
    @Transactional
    public UserDto updateProfile(String email, UpdateProfileRequest request) {
        User user = findUserByEmail(email);

        user.setFirstName(request.getFirstName().trim());
        user.setLastName(request.getLastName().trim());
        user.setPhone(request.getPhone());
        if (request.getAvatarUrl() != null) {
            user.setAvatarUrl(request.getAvatarUrl());
        }

        User updatedUser = userRepository.save(user);
        return mapToUserDto(updatedUser);
    }

    @Override
    @Transactional
    public void changePassword(String email, ChangePasswordRequest request) {
        User user = findUserByEmail(email);

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new ApiException("Current password is incorrect", HttpStatus.BAD_REQUEST);
        }

        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new ApiException("New password cannot be identical to current password", HttpStatus.BAD_REQUEST);
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AddressDto> getUserAddresses(String email) {
        User user = findUserByEmail(email);
        List<Address> addresses = addressRepository.findByUserIdOrderByIsDefaultDescCreatedAtDesc(user.getId());
        return addresses.stream().map(this::mapToAddressDto).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public AddressDto addAddress(String email, CreateAddressRequest request) {
        User user = findUserByEmail(email);

        boolean isFirstAddress = addressRepository.countByUserId(user.getId()) == 0;
        boolean shouldBeDefault = request.isDefault() || isFirstAddress;

        if (shouldBeDefault) {
            unsetExistingDefaultAddress(user.getId());
        }

        Address address = Address.builder()
                .user(user)
                .fullName(request.getFullName().trim())
                .phone(request.getPhone().trim())
                .streetAddress(request.getStreetAddress().trim())
                .apartment(request.getApartment())
                .city(request.getCity().trim())
                .state(request.getState().trim())
                .postalCode(request.getPostalCode().trim())
                .country(request.getCountry().trim())
                .addressType(request.getAddressType() != null ? request.getAddressType() : "SHIPPING")
                .isDefault(shouldBeDefault)
                .build();

        Address savedAddress = addressRepository.save(address);
        return mapToAddressDto(savedAddress);
    }

    @Override
    @Transactional
    public AddressDto updateAddress(String email, UUID addressId, UpdateAddressRequest request) {
        User user = findUserByEmail(email);
        Address address = addressRepository.findByIdAndUserId(addressId, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Address", "id", addressId));

        if (request.isDefault() && !address.isDefault()) {
            unsetExistingDefaultAddress(user.getId());
            address.setDefault(true);
        }

        address.setFullName(request.getFullName().trim());
        address.setPhone(request.getPhone().trim());
        address.setStreetAddress(request.getStreetAddress().trim());
        address.setApartment(request.getApartment());
        address.setCity(request.getCity().trim());
        address.setState(request.getState().trim());
        address.setPostalCode(request.getPostalCode().trim());
        address.setCountry(request.getCountry().trim());
        if (request.getAddressType() != null) {
            address.setAddressType(request.getAddressType());
        }

        Address updatedAddress = addressRepository.save(address);
        return mapToAddressDto(updatedAddress);
    }

    @Override
    @Transactional
    public void deleteAddress(String email, UUID addressId) {
        User user = findUserByEmail(email);
        Address address = addressRepository.findByIdAndUserId(addressId, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Address", "id", addressId));

        boolean wasDefault = address.isDefault();
        addressRepository.delete(address);

        if (wasDefault) {
            List<Address> remaining = addressRepository.findByUserIdOrderByIsDefaultDescCreatedAtDesc(user.getId());
            if (!remaining.isEmpty()) {
                Address first = remaining.get(0);
                first.setDefault(true);
                addressRepository.save(first);
            }
        }
    }

    @Override
    @Transactional
    public AddressDto setDefaultAddress(String email, UUID addressId) {
        User user = findUserByEmail(email);
        Address address = addressRepository.findByIdAndUserId(addressId, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Address", "id", addressId));

        unsetExistingDefaultAddress(user.getId());
        address.setDefault(true);

        Address updated = addressRepository.save(address);
        return mapToAddressDto(updated);
    }

    private User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    private void unsetExistingDefaultAddress(UUID userId) {
        addressRepository.findByUserIdAndIsDefaultTrue(userId).ifPresent(defaultAddr -> {
            defaultAddr.setDefault(false);
            addressRepository.save(defaultAddr);
        });
    }

    private UserDto mapToUserDto(User user) {
        return UserDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .role(user.getRole())
                .enabled(user.isEnabled())
                .createdAt(user.getCreatedAt())
                .build();
    }

    private AddressDto mapToAddressDto(Address address) {
        return AddressDto.builder()
                .id(address.getId())
                .fullName(address.getFullName())
                .phone(address.getPhone())
                .streetAddress(address.getStreetAddress())
                .apartment(address.getApartment())
                .city(address.getCity())
                .state(address.getState())
                .postalCode(address.getPostalCode())
                .country(address.getCountry())
                .addressType(address.getAddressType())
                .isDefault(address.isDefault())
                .build();
    }
}
