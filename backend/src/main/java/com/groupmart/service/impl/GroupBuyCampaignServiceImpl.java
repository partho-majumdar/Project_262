package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.groupbuy.GroupBuyCampaignDto;
import com.groupmart.dto.groupbuy.GroupBuyCampaignRequest;
import com.groupmart.dto.groupbuy.GroupBuyGroupDto;
import com.groupmart.dto.groupbuy.GroupBuyTierRequest;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.GroupBuyCampaignService;
import com.groupmart.service.GroupBuyLifecycleService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

import static com.groupmart.service.impl.GroupBuyEventRecorder.*;

@Service
@RequiredArgsConstructor
public class GroupBuyCampaignServiceImpl implements GroupBuyCampaignService {

    private final GroupBuyCampaignRepository campaignRepository;
    private final GroupBuyGroupRepository groupRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final SellerStoreRepository sellerStoreRepository;
    private final GroupBuyLifecycleService lifecycleService;
    private final GroupBuyMapper mapper;
    private final GroupBuyEventRecorder events;
    private final GroupBuyAuditLogger audit;

    // ----- Seller ------------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<GroupBuyCampaignDto> getSellerCampaigns(String sellerEmail) {
        SellerStore store = requireStore(sellerEmail);
        return campaignRepository.findBySellerStoreIdOrderByCreatedAtDesc(store.getId()).stream()
                .map(mapper::toCampaignDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public GroupBuyCampaignDto getSellerCampaign(String sellerEmail, UUID campaignId) {
        return mapper.toCampaignDto(requireOwnedCampaign(requireStore(sellerEmail), campaignId));
    }

    @Override
    @Transactional
    public GroupBuyCampaignDto createCampaign(String sellerEmail, GroupBuyCampaignRequest request) {
        SellerStore store = requireStore(sellerEmail);
        Product product = requireOwnedProduct(store, request.getProductId());
        validateRequest(request, product);

        GroupBuyCampaign campaign = GroupBuyCampaign.builder()
                .product(product)
                .sellerStore(store)
                .status(GroupBuyCampaignStatus.DRAFT)
                .build();
        applyRequest(campaign, request, product);
        return mapper.toCampaignDto(campaignRepository.save(campaign));
    }

    @Override
    @Transactional
    public GroupBuyCampaignDto updateCampaign(String sellerEmail, UUID campaignId, GroupBuyCampaignRequest request) {
        SellerStore store = requireStore(sellerEmail);
        GroupBuyCampaign campaign = requireOwnedCampaign(store, campaignId);
        if (campaign.getStatus() != GroupBuyCampaignStatus.DRAFT) {
            throw new ApiException("Only draft campaigns can be edited", HttpStatus.BAD_REQUEST);
        }
        Product product = requireOwnedProduct(store, request.getProductId());
        validateRequest(request, product);

        campaign.setProduct(product);
        applyRequest(campaign, request, product);
        campaign.setRejectionReason(null);
        return mapper.toCampaignDto(campaignRepository.save(campaign));
    }

    @Override
    @Transactional
    public GroupBuyCampaignDto publishCampaign(String sellerEmail, UUID campaignId) {
        GroupBuyCampaign campaign = lockOwnedCampaign(requireStore(sellerEmail), campaignId);
        if (campaign.getStatus() != GroupBuyCampaignStatus.DRAFT) {
            throw new ApiException("Only draft campaigns can be published", HttpStatus.BAD_REQUEST);
        }
        LocalDateTime now = LocalDateTime.now();
        if (!campaign.getEndAt().isAfter(now)) {
            throw new ApiException("This campaign's end time has passed. Update the schedule before publishing.",
                    HttpStatus.BAD_REQUEST);
        }
        // Fail fast rather than half-launching: the stock check the old approval step performed.
        Integer stock = productRepository.findStockQuantityById(campaign.getProduct().getId());
        if (stock == null || stock < campaign.getReservedQuantity()) {
            throw new ApiException("The product has only " + (stock == null ? 0 : stock)
                    + " unit(s) in stock but the campaign reserves " + campaign.getReservedQuantity(),
                    HttpStatus.BAD_REQUEST);
        }

        campaign.setSubmittedAt(now);
        if (campaign.getStartAt().isAfter(now)) {
            campaign.setStatus(GroupBuyCampaignStatus.SCHEDULED);
            events.notify(campaign.getSellerStore().getUser(), "Group buy published",
                    "'" + shortText(campaign.getTitle(), 80) + "' is scheduled and goes live on "
                            + formatTime(campaign.getStartAt()) + ".",
                    "GROUP_BUY_CAMPAIGN", SELLER_LINK);
        } else {
            lifecycleService.activateCampaign(campaignId, false);
        }
        audit.campaign(sellerEmail, "PUBLISH", campaign, "Now " + campaign.getStatus());
        return mapper.toCampaignDto(campaignRepository.findByIdForUpdate(campaignId)
                .orElse(campaign));
    }

    @Override
    @Transactional
    public GroupBuyCampaignDto pauseCampaign(String sellerEmail, UUID campaignId) {
        GroupBuyCampaign campaign = lockOwnedCampaign(requireStore(sellerEmail), campaignId);
        if (campaign.getStatus() != GroupBuyCampaignStatus.ACTIVE) {
            throw new ApiException("Only active campaigns can be paused", HttpStatus.BAD_REQUEST);
        }
        campaign.setStatus(GroupBuyCampaignStatus.PAUSED);
        audit.campaign(sellerEmail, "PAUSE", campaign, null);
        return mapper.toCampaignDto(campaign);
    }

    @Override
    @Transactional
    public GroupBuyCampaignDto resumeCampaign(String sellerEmail, UUID campaignId) {
        GroupBuyCampaign campaign = requireOwnedCampaign(requireStore(sellerEmail), campaignId);
        if (campaign.getStatus() != GroupBuyCampaignStatus.PAUSED) {
            throw new ApiException("Only paused campaigns can be resumed", HttpStatus.BAD_REQUEST);
        }
        lifecycleService.activateCampaign(campaignId, false);
        audit.campaign(sellerEmail, "RESUME", campaign, null);
        return mapper.toCampaignDto(campaign);
    }

    @Override
    @Transactional
    public GroupBuyCampaignDto cancelCampaign(String sellerEmail, UUID campaignId, String reason) {
        GroupBuyCampaign campaign = requireOwnedCampaign(requireStore(sellerEmail), campaignId);
        String note = reasonOrDefault(reason, "Cancelled by the seller");
        lifecycleService.cancelCampaign(campaignId, note, GroupBuyCloseCode.CANCELLED_BY_SELLER);
        audit.campaign(sellerEmail, "SELLER_CANCEL", campaign, "Reason: " + note);
        return mapper.toCampaignDto(campaign);
    }

    @Override
    @Transactional(readOnly = true)
    public List<GroupBuyGroupDto> getSellerCampaignGroups(String sellerEmail, UUID campaignId) {
        return toGroupDtos(requireOwnedCampaign(requireStore(sellerEmail), campaignId));
    }

    @Override
    @Transactional
    public BigDecimal updateUnitCost(String sellerEmail, UUID campaignId, BigDecimal unitCost) {
        GroupBuyCampaign campaign = lockOwnedCampaign(requireStore(sellerEmail), campaignId);
        campaign.setUnitCost(unitCost != null ? unitCost.setScale(2, RoundingMode.HALF_UP) : null);
        return campaign.getUnitCost();
    }

    // ----- Admin -------------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<GroupBuyCampaignDto> getAllCampaigns(String status) {
        List<GroupBuyCampaign> campaigns = status == null || status.isBlank()
                ? campaignRepository.findAllByOrderByCreatedAtDesc()
                : campaignRepository.findByStatusInOrderByCreatedAtDesc(List.of(parseStatus(status)));
        return campaigns.stream().map(mapper::toCampaignDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public GroupBuyCampaignDto getCampaignForAdmin(UUID campaignId) {
        return mapper.toCampaignDto(requireCampaign(campaignId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<GroupBuyGroupDto> getCampaignGroupsForAdmin(UUID campaignId) {
        return toGroupDtos(requireCampaign(campaignId));
    }

    @Override
    @Transactional
    public GroupBuyCampaignDto forceCloseCampaign(String adminEmail, UUID campaignId, String reason) {
        GroupBuyCampaign campaign = requireCampaign(campaignId);
        if (campaign.getStatus().isTerminal()) {
            throw new ApiException("This campaign has already ended", HttpStatus.BAD_REQUEST);
        }
        String note = reasonOrDefault(reason, "Closed early by an administrator");
        lifecycleService.closeCampaign(campaignId, note);
        audit.campaign(adminEmail, "FORCE_CLOSE", campaign, "Ended as " + campaign.getStatus() + ". Note: " + note);
        return mapper.toCampaignDto(campaign);
    }

    @Override
    @Transactional
    public GroupBuyCampaignDto adminCancelCampaign(String adminEmail, UUID campaignId, String reason) {
        GroupBuyCampaign campaign = requireCampaign(campaignId);
        String note = reasonOrDefault(reason, "Cancelled by an administrator");
        lifecycleService.cancelCampaign(campaignId, note, GroupBuyCloseCode.CANCELLED_BY_ADMIN);
        audit.campaign(adminEmail, "ADMIN_CANCEL", campaign, "Reason: " + note);
        return mapper.toCampaignDto(campaign);
    }

    // ----- Helpers -----------------------------------------------------------------------------

    private void validateRequest(GroupBuyCampaignRequest request, Product product) {
        if (!product.isActive()) {
            throw bad("Only active products can be used for group buys");
        }
        if (request.getMaxParticipants() < request.getMinParticipants()) {
            throw bad("Maximum participants must be greater than or equal to minimum participants");
        }
        if (!request.getEndAt().isAfter(request.getStartAt())) {
            throw bad("Campaign end time must be after its start time");
        }
        if (!request.getEndAt().isAfter(LocalDateTime.now())) {
            throw bad("Campaign end time must be in the future");
        }
        if (request.getMaxQuantityPerUser() > request.getReservedQuantity()) {
            throw bad("Max quantity per customer cannot exceed the reserved quantity");
        }
        if (request.getReservedQuantity() < request.getMinParticipants()) {
            throw bad("Reserve at least as many units as the minimum number of participants");
        }
        if (request.getReservedQuantity() > product.getStockQuantity()) {
            throw bad("Only " + product.getStockQuantity() + " unit(s) of this product are in stock");
        }

        List<GroupBuyTierRequest> tiers = request.getTiers().stream()
                .sorted(Comparator.comparingInt(GroupBuyTierRequest::getMinParticipants))
                .toList();
        Set<Integer> seen = new HashSet<>();
        BigDecimal previousPrice = product.getPrice();
        for (GroupBuyTierRequest tier : tiers) {
            if (!seen.add(tier.getMinParticipants())) {
                throw bad("Each price tier needs a different participant count");
            }
            if (tier.getMinParticipants() > request.getMaxParticipants()) {
                throw bad("The tier for " + tier.getMinParticipants() + " participants exceeds the maximum group size");
            }
            if (tier.getUnitPrice().compareTo(previousPrice) >= 0) {
                throw bad("Each tier price must be lower than the product price and the previous tier");
            }
            previousPrice = tier.getUnitPrice();
        }
        if (tiers.get(0).getMinParticipants() > request.getMinParticipants()) {
            throw bad("The first price tier must unlock at or below the minimum group size so successful groups get a discount");
        }
    }

    private void applyRequest(GroupBuyCampaign campaign, GroupBuyCampaignRequest request, Product product) {
        campaign.setTitle(request.getTitle().trim());
        campaign.setDescription(request.getDescription() != null ? request.getDescription().trim() : null);
        campaign.setBasePrice(product.getPrice());
        campaign.setMinParticipants(request.getMinParticipants());
        campaign.setMaxParticipants(request.getMaxParticipants());
        campaign.setMaxQuantityPerUser(request.getMaxQuantityPerUser());
        campaign.setReservedQuantity(request.getReservedQuantity());
        campaign.setGroupDurationHours(request.getGroupDurationHours());
        campaign.setStartAt(request.getStartAt());
        campaign.setEndAt(request.getEndAt());

        // Mutate the managed collection so orphan removal works
        campaign.getTiers().clear();
        for (GroupBuyTierRequest tier : request.getTiers()) {
            campaign.getTiers().add(GroupBuyPriceTier.builder()
                    .campaign(campaign)
                    .minParticipants(tier.getMinParticipants())
                    .unitPrice(tier.getUnitPrice().setScale(2, RoundingMode.HALF_UP))
                    .build());
        }
    }

    private List<GroupBuyGroupDto> toGroupDtos(GroupBuyCampaign campaign) {
        GroupBuyCampaignDto campaignDto = mapper.toCampaignDto(campaign);
        return groupRepository.findByCampaignIdOrderByCreatedAtDesc(campaign.getId()).stream()
                .map(group -> mapper.toGroupDto(group, null, true, campaignDto))
                .toList();
    }

    private SellerStore requireStore(String sellerEmail) {
        User user = userRepository.findByEmail(sellerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", sellerEmail));
        return sellerStoreRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ApiException("Create your seller store before running group buys",
                        HttpStatus.BAD_REQUEST));
    }

    private Product requireOwnedProduct(SellerStore store, UUID productId) {
        return productRepository.findById(productId)
                .filter(p -> p.getSellerStore() != null && p.getSellerStore().getId().equals(store.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("Product", "id", productId));
    }

    private GroupBuyCampaign requireOwnedCampaign(SellerStore store, UUID campaignId) {
        return campaignRepository.findById(campaignId)
                .filter(c -> c.getSellerStore().getId().equals(store.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyCampaign", "id", campaignId));
    }

    private GroupBuyCampaign lockOwnedCampaign(SellerStore store, UUID campaignId) {
        return campaignRepository.findByIdForUpdate(campaignId)
                .filter(c -> c.getSellerStore().getId().equals(store.getId()))
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyCampaign", "id", campaignId));
    }

    private GroupBuyCampaign requireCampaign(UUID campaignId) {
        return campaignRepository.findById(campaignId)
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyCampaign", "id", campaignId));
    }

    private GroupBuyCampaignStatus parseStatus(String status) {
        try {
            return GroupBuyCampaignStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw bad("Unknown campaign status: " + status);
        }
    }

    private static String reasonOrDefault(String reason, String fallback) {
        return reason != null && !reason.isBlank() ? reason.trim() : fallback;
    }

    private static ApiException bad(String message) {
        return new ApiException(message, HttpStatus.BAD_REQUEST);
    }
}
