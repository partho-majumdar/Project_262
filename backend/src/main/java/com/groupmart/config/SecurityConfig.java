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
            .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/register/seller").permitAll()
            .requestMatchers("/api/v1/auth/seller/apply", "/api/v1/auth/seller/application").authenticated()
            .requestMatchers("/api/v1/health/**", "/api/v1/system-status").permitAll()
            // The change-notification stream authenticates itself from a token query parameter,
            // because the browser EventSource API cannot send an Authorization header. It is
            // read-only and grants no access to any resource; every topic it names still has to be
            // refetched through the ordinary authenticated endpoints below.
            .requestMatchers("/api/v1/realtime/stream", "/api/v1/realtime/status").permitAll()
            .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/actuator/**").permitAll()

            .requestMatchers(HttpMethod.GET, "/api/v1/products/**", "/api/v1/categories/**", "/api/v1/reviews/**").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/v1/group-buys/deals/**", "/api/v1/group-buys/groups/**", "/api/v1/group-buys/products/**").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/v1/wholesale/pools/**").permitAll()
            // The two new collective marketplaces are browsable without signing in, but a customer's
            // own participations never are - those rules are listed first so they win over the
            // public "/**" patterns below.
            .requestMatchers(HttpMethod.GET, "/api/v1/reverse-group-buying/participations").authenticated()
            .requestMatchers(HttpMethod.GET, "/api/v1/group-buying-auctions/participations").authenticated()
            // A bidder's own maximum bid is private, so the proxy-auction reads that would expose it
            // stay behind authentication. The public auction and its public bid history do not.
            .requestMatchers(HttpMethod.GET, "/api/v1/auctions/my-bids", "/api/v1/auctions/*/my-bid").authenticated()
            .requestMatchers(HttpMethod.GET, "/api/v1/auctions").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/v1/auctions/*").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/v1/auctions/*/bids").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/v1/reverse-group-buying/offers/**").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/v1/group-buying-auctions/**").permitAll()
            // Group reverse demands are browsable without signing in, so a prospective member can
            // see what is forming before committing. A customer's own memberships are not public:
            // those rules are listed first so they win over the public "/**" patterns below.
            .requestMatchers(HttpMethod.GET,
                    "/api/v1/group-reverse-demands/my-led",
                    "/api/v1/group-reverse-demands/my-joined",
                    "/api/v1/group-reverse-demands/*/my-membership",
                    "/api/v1/group-reverse-demands/*/members",
                    "/api/v1/group-reverse-demands/*/offers").authenticated()
            .requestMatchers(HttpMethod.GET, "/api/v1/group-reverse-demands").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/v1/group-reverse-demands/*").permitAll()
            .requestMatchers("/api/v1/ai-assistant/**", "/api/v1/ai-search/**").permitAll()
            .requestMatchers("/api/v1/cart/**").permitAll()

            .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
            .requestMatchers("/api/v1/seller/**").hasAnyRole("SELLER", "ADMIN")

            .anyRequest().authenticated()
        );

        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
