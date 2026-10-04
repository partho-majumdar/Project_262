package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.auth.AuthResponse;
import com.groupmart.dto.auth.LoginRequest;
import com.groupmart.dto.auth.RegisterRequest;
import com.groupmart.dto.auth.SellerRegistrationRequest;
import com.groupmart.dto.auth.UserDto;
import com.groupmart.dto.seller.SellerApplicationDto;
import com.groupmart.entity.Role;
import com.groupmart.entity.SellerStatus;
import com.groupmart.entity.SellerStore;
import com.groupmart.entity.User;
import com.groupmart.repository.SellerStoreRepository;
import com.groupmart.repository.UserRepository;
import com.groupmart.security.JwtTokenProvider;
import com.groupmart.service.AuthService;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final SellerStoreRepository sellerStoreRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final AuthenticationManager authenticationManager;

    @Override
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ApiException("An account with email " + request.getEmail() + " already exists", HttpStatus.CONFLICT);
        }

        User user = User.builder()
                .email(request.getEmail().toLowerCase().trim())
                .password(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName().trim())
                .lastName(request.getLastName().trim())
                .phone(request.getPhone())
                .role(Role.ROLE_CUSTOMER)
                .sellerStatus(SellerStatus.NONE)
                .enabled(true)
                .build();

        User savedUser = userRepository.save(user);

        String token = tokenProvider.generateTokenFromEmail(savedUser.getEmail(), savedUser.getRole().name());

        return AuthResponse.builder()
                .accessToken(token)
                .tokenType("Bearer")
                .user(mapToUserDto(savedUser))
                .build();
    }

    @Override
    @Transactional
    public AuthResponse registerSeller(SellerRegistrationRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ApiException("An account with email " + request.getEmail() + " already exists", HttpStatus.CONFLICT);
        }

        if (request.getApplication() == null) {
            throw new ApiException("Seller application details are required", HttpStatus.BAD_REQUEST);
        }

        if (sellerStoreRepository.existsByStoreName(request.getApplication().getStoreName().trim())) {
            throw new ApiException("Store name '" + request.getApplication().getStoreName() + "' is already taken", HttpStatus.CONFLICT);
        }

        String email = request.getEmail().toLowerCase().trim();

        // Create the user as a customer with seller application pending
        User user = User.builder()
                .email(email)
                .password(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName().trim())
                .lastName(request.getLastName().trim())
                .phone(request.getPhone())
                .role(Role.ROLE_CUSTOMER)
                .sellerStatus(SellerStatus.PENDING)
                .enabled(true)
                .build();
        User savedUser = userRepository.save(user);

        // Create the seller store and mark as pending review
        String baseSlug = request.getApplication().getStoreName().toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-");
        String slug = baseSlug;
        int count = 1;
        while (sellerStoreRepository.existsByStoreSlug(slug)) {
            slug = baseSlug + "-" + count++;
        }

        SellerStore store = SellerStore.builder()
                .user(savedUser)
                .storeName(request.getApplication().getStoreName().trim())
                .storeSlug(slug)
                .description(request.getApplication().getDescription())
                .logoUrl(request.getApplication().getLogoUrl())
                .bannerUrl(request.getApplication().getBannerUrl())
                .taxId(request.getApplication().getTaxId())
                .bankAccount(request.getApplication().getBankAccount())
                .bankName(request.getApplication().getBankName())
                .verified(false)
                .rating(0.0)
                .totalSales(0)
                .build();
        sellerStoreRepository.save(store);

        String token = tokenProvider.generateTokenFromEmail(savedUser.getEmail(), savedUser.getRole().name());

        return AuthResponse.builder()
                .accessToken(token)
                .tokenType("Bearer")
                .user(mapToUserDto(savedUser))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail().toLowerCase().trim(), request.getPassword())
        );

        User user = userRepository.findByEmail(request.getEmail().toLowerCase().trim())
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", request.getEmail()));

        String token = tokenProvider.generateToken(authentication);

        return AuthResponse.builder()
                .accessToken(token)
                .tokenType("Bearer")
                .user(mapToUserDto(user))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public UserDto getCurrentUser(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
        return mapToUserDto(user);
    }

    @Override
    @Transactional(readOnly = true)
    public SellerApplicationDto getCurrentSellerApplication(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
        SellerStore store = sellerStoreRepository.findByUserId(user.getId()).orElse(null);
        return SellerApplicationDto.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .phone(user.getPhone())
                .sellerStatus(user.getSellerStatus())
                .sellerStatusReason(user.getSellerStatusReason())
                .sellerReviewedAt(user.getSellerReviewedAt())
                .submittedAt(store != null ? store.getCreatedAt() : null)
                .store(null)
                .build();
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
                .sellerStatus(user.getSellerStatus())
                .enabled(user.isEnabled())
                .createdAt(user.getCreatedAt())
                .build();
    }
}

