package com.groupmart.settings;

import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.groupmart.repository.PlatformSettingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The admin settings HTTP contract.
 *
 * <p>These assertions exist because the endpoint used to answer a caller that forgot the
 * request body with a 500 whose message leaked the handler's Java signature, which reads as a
 * server fault rather than the client mistake it is.
 */
@AutoConfigureMockMvc
@SpringBootTest
@ActiveProfiles("test")
class PlatformSettingControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private PlatformSettingRepository platformSettingRepository;

    private static final String ADMIN = "admin@groupmart.com";

    @BeforeEach
    void clearSettings() {
        platformSettingRepository.deleteAll();
        platformSettingRepository.flush();
    }

    @Test
    void bulkSavePersistsAndReturnsTheEffectiveSettings() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("shipping.tier", "Free Shipping Tier"));

        mockMvc.perform(put("/api/v1/admin/settings")
                        .with(user(ADMIN).authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data['shipping.tier']").value("Free Shipping Tier"))
                .andExpect(jsonPath("$.data['payment.stripe.enabled']").value("true"));
    }

    @Test
    void missingBodyIsRejectedAsBadRequestNotServerError() throws Exception {
        mockMvc.perform(put("/api/v1/admin/settings")
                        .with(user(ADMIN).authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.statusCode").value(400))
                .andExpect(jsonPath("$.message").value("The request body is missing or malformed."));
    }

    @Test
    void malformedJsonIsRejectedAsBadRequest() throws Exception {
        mockMvc.perform(put("/api/v1/admin/settings")
                        .with(user(ADMIN).authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ this is not json "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.statusCode").value(400));
    }

    @Test
    void missingBodyOnSellerApplicationDecisionIsBadRequest() throws Exception {
        mockMvc.perform(put("/api/v1/admin/sellers/applications/{userId}/decision", UUID.randomUUID())
                        .with(user(ADMIN).authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("The request body is missing or malformed."));
    }

    @Test
    void settingsRequireTheAdminRole() throws Exception {
        mockMvc.perform(put("/api/v1/admin/settings")
                        .with(user("seller@test.local").authorities(new SimpleGrantedAuthority("ROLE_SELLER")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }
}
