package com.groupmart.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import com.groupmart.common.response.ApiResponse;
import com.groupmart.dto.auth.AuthResponse;
import com.groupmart.dto.auth.LoginRequest;
import com.groupmart.dto.auth.RegisterRequest;
import com.groupmart.dto.auth.SellerApplicationRequest;
import com.groupmart.dto.auth.SellerRegistrationRequest;
import com.groupmart.dto.auth.UserDto;
import com.groupmart.dto.seller.SellerApplicationDto;
import com.groupmart.service.AuthService;
import com.groupmart.service.SellerService;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final SellerService sellerService;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return new ResponseEntity<>(
                ApiResponse.success("User registered successfully", response, HttpStatus.CREATED.value()),
                HttpStatus.CREATED
        );
    }

    @PostMapping("/register/seller")
    public ResponseEntity<ApiResponse<AuthResponse>> registerSeller(@Valid @RequestBody SellerRegistrationRequest request) {
        AuthResponse response = authService.registerSeller(request);
        return new ResponseEntity<>(
                ApiResponse.success("Seller account created. Awaiting administrator approval.", response, HttpStatus.CREATED.value()),
                HttpStatus.CREATED
        );
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.success("Authentication successful", response));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserDto>> getCurrentUser(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Unauthorized: User session missing", HttpStatus.UNAUTHORIZED.value()));
        }
        UserDto user = authService.getCurrentUser(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Current user profile retrieved", user));
    }

    @PostMapping("/seller/apply")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<SellerApplicationDto>> submitSellerApplication(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody SellerApplicationRequest request
    ) {
        SellerApplicationDto application = sellerService.submitSellerApplication(userDetails.getUsername(), request);
        return new ResponseEntity<>(
                ApiResponse.success("Seller application submitted for administrator review", application, HttpStatus.CREATED.value()),
                HttpStatus.CREATED
        );
    }

    @GetMapping("/seller/application")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<SellerApplicationDto>> getMySellerApplication(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        SellerApplicationDto application = sellerService.getSellerApplicationByEmail(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success("Current seller application retrieved", application));
    }
}

