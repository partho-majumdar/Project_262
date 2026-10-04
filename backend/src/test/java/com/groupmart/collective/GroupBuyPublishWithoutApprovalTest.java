package com.groupmart.collective;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.groupmart.dto.groupbuy.GroupBuyCampaignDto;
import com.groupmart.dto.groupbuy.GroupBuyCampaignRequest;
import com.groupmart.dto.groupbuy.GroupBuyTierRequest;
import com.groupmart.entity.GroupBuyCampaignStatus;
import com.groupmart.entity.Product;
import com.groupmart.entity.Role;
import com.groupmart.entity.SellerStore;
import com.groupmart.repository.GroupBuyCampaignRepository;
import com.groupmart.service.GroupBuyCampaignService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The admin approval gate for group buy campaigns was removed: a seller now publishes straight to the
 * storefront and the admin side only monitors. These tests pin that behaviour so the gate cannot be
 * silently reintroduced, and keep the validations the old approval step used to perform.
 */
class GroupBuyPublishWithoutApprovalTest extends AbstractCollectiveIntegrationTest {

    @Autowired GroupBuyCampaignRepository campaignRepository;
    @Autowired GroupBuyCampaignService campaignService;

    private GroupBuyCampaignRequest buildRequest(UUID productId, LocalDateTime startAt) {
        return GroupBuyCampaignRequest.builder()
                .productId(productId)
                .title("No approval needed")
                .description("Published straight to the storefront")
                .minParticipants(2)
                .maxParticipants(10)
                .maxQuantityPerUser(2)
                .reservedQuantity(10)
                .groupDurationHours(24)
                .startAt(startAt)
                .endAt(startAt.plusDays(5))
                .tiers(List.of(GroupBuyTierRequest.builder()
                        .minParticipants(2)
                        .unitPrice(new BigDecimal("90.00"))
                        .build()))
                .build();
    }

    @Test
    @DisplayName("A campaign is created as DRAFT and holds no inventory")
    void createLeavesCampaignInDraft() {
        SellerStore store = createSellerStore(createUser("gb-pub", Role.ROLE_SELLER));
        Product product = createProduct(store, createCategory(), new BigDecimal("100.00"), 50);

        GroupBuyCampaignDto dto = campaignService.createCampaign(
                store.getUser().getEmail(), buildRequest(product.getId(), LocalDateTime.now().plusDays(1)));

        assertThat(dto.getStatus()).isEqualTo(GroupBuyCampaignStatus.DRAFT);
        assertThat(dto.isInventoryReserved()).isFalse();
    }

    @Test
    @DisplayName("Publishing goes straight to ACTIVE and reserves inventory, with no admin in the loop")
    void publishActivatesImmediatelyWhenStartTimeHasPassed() {
        SellerStore store = createSellerStore(createUser("gb-pub", Role.ROLE_SELLER));
        Product product = createProduct(store, createCategory(), new BigDecimal("100.00"), 50);
        String email = store.getUser().getEmail();

        GroupBuyCampaignDto created = campaignService.createCampaign(
                email, buildRequest(product.getId(), LocalDateTime.now().minusMinutes(5)));
        GroupBuyCampaignDto published = campaignService.publishCampaign(email, created.getId());

        assertThat(published.getStatus()).isEqualTo(GroupBuyCampaignStatus.ACTIVE);
        assertThat(published.isInventoryReserved()).isTrue();
        // 10 reserved units leave the seller's stock at activation.
        assertThat(productRepository.findStockQuantityById(product.getId())).isEqualTo(40);
    }

    @Test
    @DisplayName("A future start time schedules the campaign instead of going live, and holds no stock yet")
    void publishSchedulesWhenStartTimeIsInTheFuture() {
        SellerStore store = createSellerStore(createUser("gb-pub", Role.ROLE_SELLER));
        Product product = createProduct(store, createCategory(), new BigDecimal("100.00"), 50);
        String email = store.getUser().getEmail();

        GroupBuyCampaignDto created = campaignService.createCampaign(
                email, buildRequest(product.getId(), LocalDateTime.now().plusDays(2)));
        GroupBuyCampaignDto published = campaignService.publishCampaign(email, created.getId());

        assertThat(published.getStatus()).isEqualTo(GroupBuyCampaignStatus.SCHEDULED);
        // Nothing is reserved until the scheduled activation actually runs.
        assertThat(productRepository.findStockQuantityById(product.getId())).isEqualTo(50);
    }

    @Test
    @DisplayName("A campaign cannot be created asking for more units than the product has in stock")
    void createRejectsInsufficientStock() {
        SellerStore store = createSellerStore(createUser("gb-pub", Role.ROLE_SELLER));
        Product product = createProduct(store, createCategory(), new BigDecimal("100.00"), 4);

        assertThatThrownBy(() -> campaignService.createCampaign(
                store.getUser().getEmail(), buildRequest(product.getId(), LocalDateTime.now().minusMinutes(5))))
                .hasMessageContaining("in stock");
    }

    @Test
    @DisplayName("Publishing re-checks stock that disappeared after the campaign was created")
    void publishRechecksStockThatVanishedAfterCreation() {
        SellerStore store = createSellerStore(createUser("gb-pub", Role.ROLE_SELLER));
        Product product = createProduct(store, createCategory(), new BigDecimal("100.00"), 50);
        String email = store.getUser().getEmail();

        GroupBuyCampaignDto created = campaignService.createCampaign(
                email, buildRequest(product.getId(), LocalDateTime.now().minusMinutes(5)));

        // Another channel drains the product after the draft was created.
        Product reloaded = productRepository.findById(product.getId()).orElseThrow();
        reloaded.setStockQuantity(5);
        productRepository.save(reloaded);
        productRepository.flush();

        assertThatThrownBy(() -> campaignService.publishCampaign(email, created.getId()))
                .hasMessageContaining("in stock");
    }

    @Test
    @DisplayName("A campaign cannot be published twice")
    void publishIsNotRepeatable() {
        SellerStore store = createSellerStore(createUser("gb-pub", Role.ROLE_SELLER));
        Product product = createProduct(store, createCategory(), new BigDecimal("100.00"), 50);
        String email = store.getUser().getEmail();

        GroupBuyCampaignDto created = campaignService.createCampaign(
                email, buildRequest(product.getId(), LocalDateTime.now().minusMinutes(5)));
        campaignService.publishCampaign(email, created.getId());

        assertThatThrownBy(() -> campaignService.publishCampaign(email, created.getId()))
                .hasMessageContaining("Only draft campaigns can be published");
    }

    @Test
    @DisplayName("A live campaign can no longer be edited")
    void liveCampaignIsNotEditable() {
        SellerStore store = createSellerStore(createUser("gb-pub", Role.ROLE_SELLER));
        Product product = createProduct(store, createCategory(), new BigDecimal("100.00"), 50);
        String email = store.getUser().getEmail();

        GroupBuyCampaignDto created = campaignService.createCampaign(
                email, buildRequest(product.getId(), LocalDateTime.now().minusMinutes(5)));
        campaignService.publishCampaign(email, created.getId());

        assertThatThrownBy(() -> campaignService.updateCampaign(
                email, created.getId(), buildRequest(product.getId(), LocalDateTime.now().minusMinutes(5))))
                .hasMessageContaining("Only draft campaigns can be edited");
    }

    @Test
    @DisplayName("Cancelling a live campaign releases the reserved units again")
    void cancelReleasesReservedInventory() {
        SellerStore store = createSellerStore(createUser("gb-pub", Role.ROLE_SELLER));
        Product product = createProduct(store, createCategory(), new BigDecimal("100.00"), 50);
        String email = store.getUser().getEmail();

        GroupBuyCampaignDto created = campaignService.createCampaign(
                email, buildRequest(product.getId(), LocalDateTime.now().minusMinutes(5)));
        campaignService.publishCampaign(email, created.getId());
        assertThat(productRepository.findStockQuantityById(product.getId())).isEqualTo(40);

        campaignService.cancelCampaign(email, created.getId(), "smoke cleanup");

        assertThat(productRepository.findStockQuantityById(product.getId())).isEqualTo(50);
    }
}
