package com.groupmart.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.groupmart.realtime.RealtimeChangeInterceptor;

import lombok.RequiredArgsConstructor;

/**
 * Registers the change interceptor across the REST API.
 * <p>
 * The stream endpoint itself is excluded inside the interceptor, so registering both together is
 * safe.
 */
@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final RealtimeChangeInterceptor realtimeChangeInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(realtimeChangeInterceptor)
                .addPathPatterns("/api/v1/**")
                .excludePathPatterns("/api/v1/realtime/**");
    }
}
