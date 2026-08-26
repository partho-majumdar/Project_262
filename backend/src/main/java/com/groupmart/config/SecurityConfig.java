package com.groupmart.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import com.groupmart.security.JwtAuthenticationEntryPoint;
import com.groupmart.security.JwtAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationEntryPoint unauthorizedHandler;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> {})
            .exceptionHandling(exception -> exception.authenticationEntryPoint(unauthorizedHandler))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // .authorizeHttpRequests(auth -> auth
            //     // Public Auth & Health Endpoints
            //     .requestMatchers("/api/v1/auth/**").permitAll()
            //     .requestMatchers("/api/v1/health/**", "/api/v1/system-status").permitAll()
            //     .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/actuator/**").permitAll()
                
            //     // Public Catalog & AI Endpoints
            //     .requestMatchers(HttpMethod.GET, "/api/v1/products/**", "/api/v1/categories/**", "/api/v1/reviews/**").permitAll()
            //     .requestMatchers("/api/v1/ai-assistant/**", "/api/v1/ai-search/**").permitAll()
            //     .requestMatchers("/api/v1/cart/**").permitAll()
                
            //     // Role-Based Endpoints
            //     .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
            //     .requestMatchers("/api/v1/seller/**").hasAnyRole("SELLER", "ADMIN")
                
            //     .anyRequest().authenticated()
            // );
            .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/v1/auth/**").permitAll()
            .requestMatchers("/api/v1/health/**", "/api/v1/system-status").permitAll()
            .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/actuator/**").permitAll()

            .requestMatchers(HttpMethod.GET, "/api/v1/products/**", "/api/v1/categories/**", "/api/v1/reviews/**").permitAll()
            .requestMatchers("/api/v1/ai-assistant/**", "/api/v1/ai-search/**").permitAll()
            .requestMatchers("/api/v1/cart/**").permitAll()

            // Allow any authenticated user to register a seller store
            .requestMatchers(HttpMethod.POST, "/api/v1/seller/store").authenticated()

            .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
            .requestMatchers("/api/v1/seller/**").hasAnyRole("SELLER", "ADMIN")

            .anyRequest().authenticated()
        );

        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
