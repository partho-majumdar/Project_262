package com.groupmart.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.auth.UserDto;
import com.groupmart.dto.user.*;
import com.groupmart.service.UserService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<UserDto>> getProfile(@AuthenticationPrincipal UserDetails userDetails) {
        UserDto profile = userService.getProfile(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("User profile fetched successfully", profile));
    }

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<UserDto>> updateProfile(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody UpdateProfileRequest request
    ) {
        UserDto updatedProfile = userService.updateProfile(userDetails.getUsername(), request);
        return ResponseEntity.ok(ApiResponse.success("User profile updated successfully", updatedProfile));
    }

    @PutMapping("/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        userService.changePassword(userDetails.getUsername(), request);
        return ResponseEntity.ok(ApiResponse.success("Password changed successfully", null));
    }

    @GetMapping("/addresses")
    public ResponseEntity<ApiResponse<List<AddressDto>>> getUserAddresses(@AuthenticationPrincipal UserDetails userDetails) {
        List<AddressDto> addresses = userService.getUserAddresses(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("User addresses fetched successfully", addresses));
    }

    @PostMapping("/addresses")
    public ResponseEntity<ApiResponse<AddressDto>> addAddress(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CreateAddressRequest request
    ) {
        AddressDto address = userService.addAddress(userDetails.getUsername(), request);
        return new ResponseEntity<>(ApiResponse.success("Address added successfully", address, HttpStatus.CREATED.value()), HttpStatus.CREATED);
    }

    @PutMapping("/addresses/{addressId}")
    public ResponseEntity<ApiResponse<AddressDto>> updateAddress(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID addressId,
            @Valid @RequestBody UpdateAddressRequest request
    ) {
        AddressDto address = userService.updateAddress(userDetails.getUsername(), addressId, request);
        return ResponseEntity.ok(ApiResponse.success("Address updated successfully", address));
    }

    @DeleteMapping("/addresses/{addressId}")
    public ResponseEntity<ApiResponse<Void>> deleteAddress(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID addressId
    ) {
        userService.deleteAddress(userDetails.getUsername(), addressId);
        return ResponseEntity.ok(ApiResponse.success("Address deleted successfully", null));
    }

    @PutMapping("/addresses/{addressId}/set-default")
    public ResponseEntity<ApiResponse<AddressDto>> setDefaultAddress(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID addressId
    ) {
        AddressDto address = userService.setDefaultAddress(userDetails.getUsername(), addressId);
        return ResponseEntity.ok(ApiResponse.success("Default address updated successfully", address));
    }
}
