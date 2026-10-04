package com.groupmart.groupreverse;

import java.math.BigDecimal;

import java.util.Arrays;
import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.groupmart.entity.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The HTTP layer's own rules. The service tests prove who may do what once a request is inside the
 * application; these prove that an unauthenticated caller never gets that far, and that the public
 * browse really is public.
 */
@AutoConfigureMockMvc
class GroupReverseSecurityTest extends AbstractGroupReverseTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired PasswordEncoder encoder;

    private static final BigDecimal TARGET = new BigDecimal("2000");
    private static final BigDecimal MAX = new BigDecimal("2100");

    private GroupReverseDemand publishedDemand() {
        User leader = createUser("leader", Role.ROLE_CUSTOMER);
        Product product = createProduct(createSellerStore(createUser("cat", Role.ROLE_SELLER)),
                new BigDecimal("3000"), 100);
        return createOpenDemand(leader, product, 10, TARGET, MAX, 24);
    }

    /** Role enum names already carry the ROLE_ prefix that Spring Security expects. */
    private List<GrantedAuthority> rolesOf(Role... roles) {
        return Arrays.stream(roles)
                .map(role -> (GrantedAuthority) new SimpleGrantedAuthority(role.name()))
                .toList();
    }

    @Test
    void theMarketplaceAndADemandArePubliclyReadable() throws Exception {
        GroupReverseDemand demand = publishedDemand();
        mockMvc.perform(get("/api/v1/group-reverse-demands")).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/group-reverse-demands/" + demand.getId()))
                .andExpect(status().isOk());
    }

    @Test
    void everythingThatRevealsWhoIsInTheGroupRequiresALogin() throws Exception {
        GroupReverseDemand demand = publishedDemand();
        String id = demand.getId().toString();

        mockMvc.perform(get("/api/v1/group-reverse-demands/my-led"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/group-reverse-demands/my-joined"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/group-reverse-demands/" + id + "/members"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/group-reverse-demands/" + id + "/my-membership"))
                .andExpect(status().isUnauthorized());
        // The competing bids are the leader's private ballot.
        mockMvc.perform(get("/api/v1/group-reverse-demands/" + id + "/offers"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void aVisitorCannotStartOrJoinAnything() throws Exception {
        GroupReverseDemand demand = publishedDemand();
        String id = demand.getId().toString();
        String body = objectMapper.writeValueAsString(java.util.Map.of(
                "productId", demand.getProduct().getId(), "requiredQuantity", 10,
                "targetPrice", TARGET, "maxPrice", MAX, "description", "anonymous"));

        mockMvc.perform(post("/api/v1/group-reverse-demands")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/group-reverse-demands/" + id + "/join")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/group-reverse-demands/" + id + "/publish"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/group-reverse-demands/" + id + "/cancel"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void aCustomerCannotBidOrReachTheSellerArea() throws Exception {
        GroupReverseDemand demand = publishedDemand();
        String id = demand.getId().toString();

        // The only way to submit an offer is the seller endpoint, and a customer may not use it.
        mockMvc.perform(post("/api/v1/seller/group-reverse-demands/" + id + "/offers")
                        .with(user("customer@test.groupmart.local")
                                .authorities(rolesOf(Role.ROLE_CUSTOMER)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of(
                                "unitPrice", 1900, "offeredQuantity", 10,
                                "deliveryFee", 0, "estimatedDeliveryDays", 3))))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/seller/group-reverse-demands/available")
                        .with(user("customer@test.groupmart.local")
                                .authorities(rolesOf(Role.ROLE_CUSTOMER))))
                .andExpect(status().isForbidden());
    }

    @Test
    void onlyAnAdminMayUseTheAdminArea() throws Exception {
        GroupReverseDemand demand = publishedDemand();
        mockMvc.perform(get("/api/v1/admin/group-reverse-demands")
                        .with(user("customer@test.groupmart.local")
                                .authorities(rolesOf(Role.ROLE_CUSTOMER))))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/admin/group-reverse-demands/" + demand.getId() + "/cancel")
                        .with(user("seller@test.groupmart.local")
                                .authorities(rolesOf(Role.ROLE_SELLER)))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void aLoggedInCustomerMayReadTheGroupDetailAndTheirOwnMembership() throws Exception {
        GroupReverseDemand demand = publishedDemand();
        String id = demand.getId().toString();
        // A real account, because asking about your own membership means being somebody.
        User member = createUser("member", Role.ROLE_CUSTOMER);
        var principal = user(member.getEmail()).authorities(rolesOf(Role.ROLE_CUSTOMER));

        mockMvc.perform(get("/api/v1/group-reverse-demands/" + id).with(principal))
                .andExpect(status().isOk());
        // They have not joined, so there is no membership - but the answer is an empty one rather
        // than somebody else's record.
        mockMvc.perform(get("/api/v1/group-reverse-demands/" + id + "/my-membership").with(principal))
                .andExpect(status().isOk());
    }

    @Test
    void anIdentityThatIsNotAnAccountCannotClaimAMembership() throws Exception {
        GroupReverseDemand demand = publishedDemand();
        mockMvc.perform(get("/api/v1/group-reverse-demands/" + demand.getId() + "/my-membership")
                        .with(user("ghost@test.groupmart.local")
                                .authorities(rolesOf(Role.ROLE_CUSTOMER))))
                .andExpect(status().isNotFound());
    }
}
