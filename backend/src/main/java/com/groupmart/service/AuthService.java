package com.groupmart.service;

import com.groupmart.dto.auth.AuthResponse;
import com.groupmart.dto.auth.LoginRequest;
import com.groupmart.dto.auth.RegisterRequest;
import com.groupmart.dto.auth.UserDto;

public interface AuthService {

    AuthResponse register(RegisterRequest request);

    AuthResponse login(LoginRequest request);

    UserDto getCurrentUser(String email);
}
