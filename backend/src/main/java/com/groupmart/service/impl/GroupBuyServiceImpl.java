package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.groupbuy.*;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.GroupBuyLifecycleService;
import com.groupmart.service.GroupBuyService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.*;
import java.util.function.Predicate;
import java.util.stream.Collectors;

import static com.groupmart.service.impl.GroupBuyEventRecorder.*;

@Service
@RequiredArgsConstructor
public class GroupBuyServiceImpl implements GroupBuyService {

    private static final Set<PaymentMethod> ONLINE_PAYMENT_METHODS = EnumSet.of(
            PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD, PaymentMethod.PAYPAL, PaymentMethod.STRIPE);
    private static final Set<GroupBuyCampaignStatus> PUBLIC_STATUSES = EnumSet.of(
            GroupBuyCampaignStatus.SCHEDULED, GroupBuyCampaignStatus.ACTIVE, GroupBuyCampaignStatus.PAUSED,
            GroupBuyCampaignStatus.SUCCESS, GroupBuyCampaignStatus.FAILED, GroupBuyCampaignStatus.CANCELLED);
    private static final String INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int INVITE_CODE_LENGTH = 8;
    private static final long MIN_GROUP_WINDOW_MINUTES = 10;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final GroupBuyCampaignRepository campaignRepository;
    private final GroupBuyGroupRepository groupRepository;
    private final GroupBuyParticipantRepository participantRepository;
    private final UserRepository userRepository;
    private final AddressRepository addressRepository;
    private final GroupBuyLifecycleService lifecycleService;
    private final GroupBuyMapper mapper;
    private final GroupBuyEventRecorder events;
    private final GroupBuyDealAlerts dealAlerts;
    private final GroupBuyDealFollowRepository followRepository;

    // ----- Browsing ----------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<GroupBuyCampaignDto> getActiveDeals(String query, String categorySlug, String sort) {
        LocalDateTime now = LocalDateTime.now();
        String needle = query != null && !query.isBlank() ? query.trim().toLowerCase() : null;
        String category = categorySlug != null && !categorySlug.isBlank() ? categorySlug.trim() : null;

        List<GroupBuyCampaignDto> deals = campaignRepository
                .findByStatusOrderByEndAtAsc(GroupBuyCampaignStatus.ACTIVE).stream()
                .filter(c -> !c.getStartAt().isAfter(now) && c.getEndAt().isAfter(now))
                .filter(c -> needle == null || matches(c, needle))
                .filter(c -> category == null || (c.getProduct().getCategory() != null
                        && category.equalsIgnoreCase(c.getProduct().getCategory().getSlug())))
                .map(mapper::toCampaignDto)
                .collect(Collectors.toCollection(ArrayList::new));
        deals.sort(dealComparator(sort));
        return deals;
    }

    @Override
    @Transactional(readOnly = true)
    public GroupBuyDealDetailDto getDeal(UUID campaignId, String viewerEmail) {
        GroupBuyCampaign campaign = campaignRepository.findById(campaignId)
                .filter(c -> PUBLIC_STATUSES.contains(c.getStatus()))
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyCampaign", "id", campaignId));
        User viewer = findViewer(viewerEmail);
        LocalDateTime now = LocalDateTime.now();
        GroupBuyCampaignDto campaignDto = mapper.toCampaignDto(campaign);

        List<GroupBuyGroup> groups = groupRepository.findByCampaignIdOrderByCreatedAtDesc(campaignId);
        List<GroupBuyGroupDto> openGroups = groups.stream()
                .filter(g -> g.getStatus() == GroupBuyGroupStatus.OPEN && g.getExpiresAt().isAfter(now))
                .sorted(Comparator.comparing(GroupBuyGroup::getExpiresAt))
                .map(g -> mapper.toGroupDto(g, viewer, false, campaignDto))
                .toList();
        List<GroupBuyGroupDto> recentSuccessful = groups.stream()
                .filter(g -> g.getStatus() == GroupBuyGroupStatus.SUCCESS)
                .limit(5)
                .map(g -> mapper.toGroupDto(g, viewer, false, campaignDto))
                .toList();

        UUID myActiveGroupId = viewer == null ? null
                : participantRepository.findActiveGroupIdsInCampaign(viewer.getId(), campaignId).stream()
                .findFirst().orElse(null);
        String blockedReason = startBlockedReason(campaign, viewer, myActiveGroupId, now);

        return GroupBuyDealDetailDto.builder()
                .campaign(campaignDto)
                .openGroups(openGroups)
                .recentSuccessfulGroups(recentSuccessful)
                .myActiveGroupId(myActiveGroupId)
                .canStartGroup(blockedReason == null)
                .startGroupBlockedReason(blockedReason)
                .following(viewer != null && followRepository.existsByCampaignIdAndUserId(campaignId, viewer.getId()))
                .followerCount(followRepository.countByCampaignId(campaignId))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<GroupBuyCampaignDto> getActiveDealsForProduct(UUID productId) {
        LocalDateTime now = LocalDateTime.now();
        return campaignRepository.findByProductIdAndStatus(productId, GroupBuyCampaignStatus.ACTIVE).stream()
                .filter(c -> !c.getStartAt().isAfter(now) && c.getEndAt().isAfter(now))
                .map(mapper::toCampaignDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public GroupBuyGroupDto getGroup(UUID groupId, String viewerEmail) {
        GroupBuyGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyGroup", "id", groupId));
        return mapper.toGroupDto(group, findViewer(viewerEmail), true);
    }

    @Override
    @Transactional(readOnly = true)
    public GroupBuyGroupDto getGroupByInviteCode(String inviteCode, String viewerEmail) {
        String code = inviteCode == null ? "" : inviteCode.trim().toUpperCase();
        GroupBuyGroup group = groupRepository.findByInviteCode(code)
                .orElseThrow(() -> new ApiException("No group found for invite code " + code, HttpStatus.NOT_FOUND));
        return mapper.toGroupDto(group, findViewer(viewerEmail), true);
    }

    // ----- Start / join / leave ----------------------------------------------------------------

    @Override
    @Transactional
    public GroupBuyGroupDto startGroup(String userEmail, UUID campaignId, JoinGroupBuyRequest request) {
        User user = requireUser(userEmail);
        GroupBuyCampaign campaign = campaignRepository.findByIdForUpdate(campaignId)
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyCampaign", "id", campaignId));
        LocalDateTime now = LocalDateTime.now();

        UUID activeGroupId = participantRepository.findActiveGroupIdsInCampaign(user.getId(), campaignId).stream()
                .findFirst().orElse(null);
        String blocked = startBlockedReason(campaign, user, activeGroupId, now);
        if (blocked != null) {
            throw new ApiException(blocked, HttpStatus.BAD_REQUEST);
        }
        validateQuantity(campaign, request.getQuantity());
        Address address = requireAddress(user, request.getAddressId());
        validatePaymentMethod(request.getPaymentMethod());

        LocalDateTime groupDeadline = now.plusHours(campaign.getGroupDurationHours());
        LocalDateTime expiresAt = groupDeadline.isBefore(campaign.getEndAt()) ? groupDeadline : campaign.getEndAt();

        GroupBuyGroup group = groupRepository.save(GroupBuyGroup.builder()
                .campaign(campaign)
                .startedBy(user)
                .leader(user)
                .inviteCode(generateInviteCode())
                .status(GroupBuyGroupStatus.OPEN)
                .expiresAt(expiresAt)
                .build());

        events.activity(group, user, "GROUP_STARTED", displayName(user) + " started this group");
        addParticipant(campaign, group, user, request, address, null, null);
        events.notify(user, "Your group is live",
                "Share invite code " + group.getInviteCode() + " to fill your group for '"
                        + shortText(campaign.getProduct().getName(), 60) + "' before "
                        + formatTime(expiresAt) + ".",
                "GROUP_BUY_JOIN", groupLink(group.getId()));

        settleIfFull(campaign, group);
        return mapper.toGroupDto(group, user, true);
    }

    @Override
    @Transactional
    public GroupBuyGroupDto joinGroup(String userEmail, UUID groupId, JoinGroupBuyRequest request) {
        User user = requireUser(userEmail);
        UUID campaignId = groupRepository.findCampaignIdByGroupId(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyGroup", "id", groupId));
        // Lock order: campaign, then group (matches the lifecycle service)
        GroupBuyCampaign campaign = campaignRepository.findByIdForUpdate(campaignId)
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyCampaign", "id", campaignId));
        GroupBuyGroup group = groupRepository.findByIdForUpdate(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyGroup", "id", groupId));
        LocalDateTime now = LocalDateTime.now();

        assertAcceptingParticipants(campaign, user, now);
        if (group.getStatus() != GroupBuyGroupStatus.OPEN || !group.getExpiresAt().isAfter(now)) {
            throw new ApiException("This group is no longer open", HttpStatus.BAD_REQUEST);
        }
        if (group.getParticipantCount() >= campaign.getMaxParticipants()) {
            throw new ApiException("This group is already full", HttpStatus.BAD_REQUEST);
        }

        GroupBuyParticipant existing = participantRepository.findByBuyGroupIdAndUserId(groupId, user.getId())
                .orElse(null);
        if (existing != null && existing.getStatus() == GroupBuyParticipantStatus.JOINED) {
            throw new ApiException("You're already in this group", HttpStatus.BAD_REQUEST);
        }
        if (!participantRepository.findActiveGroupIdsInCampaign(user.getId(), campaignId).isEmpty()) {
            throw new ApiException("You're already in another active group for this deal", HttpStatus.BAD_REQUEST);
        }

        validateQuantity(campaign, request.getQuantity());
        Address address = requireAddress(user, request.getAddressId());
        validatePaymentMethod(request.getPaymentMethod());
        User inviter = resolveInviter(request.getInvitedByUserId(), user, groupId);

        addParticipant(campaign, group, user, request, address, inviter, existing);
        settleIfFull(campaign, group);
        return mapper.toGroupDto(group, user, true);
    }

    @Override
    @Transactional
    public GroupBuyGroupDto leaveGroup(String userEmail, UUID groupId) {
        User user = requireUser(userEmail);
        lifecycleService.removeMember(groupId, user.getId(), false, null);
        GroupBuyGroup group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyGroup", "id", groupId));
        return mapper.toGroupDto(group, user, true);
    }

    // ----- Following deals -------------------------------------------------------------------

    @Override
    @Transactional
    public GroupBuyDealDetailDto followDeal(String userEmail, UUID campaignId) {
        User user = requireUser(userEmail);
        GroupBuyCampaign campaign = campaignRepository.findById(campaignId)
                .filter(c -> PUBLIC_STATUSES.contains(c.getStatus()))
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyCampaign", "id", campaignId));
        if (campaign.getStatus().isTerminal()) {
            throw new ApiException("This group buy has already ended", HttpStatus.BAD_REQUEST);
        }
        if (isSellerOf(campaign, user)) {
            throw new ApiException("You can't follow a group buy for your own product", HttpStatus.BAD_REQUEST);
        }
        if (!followRepository.existsByCampaignIdAndUserId(campaignId, user.getId())) {
            // Start from the best price already on offer so only further discounts trigger alerts
            BigDecimal bestOpenPrice = groupRepository.findByCampaignIdOrderByCreatedAtDesc(campaignId).stream()
                    .filter(g -> g.getStatus() == GroupBuyGroupStatus.OPEN)
                    .map(g -> GroupBuyPricing.unitPriceFor(campaign, g.getParticipantCount()))
                    .min(BigDecimal::compareTo)
                    .orElse(null);
            followRepository.save(GroupBuyDealFollow.builder()
                    .campaign(campaign)
                    .user(user)
                    .lastAlertedPrice(bestOpenPrice)
                    .build());
        }
        return getDeal(campaignId, userEmail);
    }

    @Override
    @Transactional
    public GroupBuyDealDetailDto unfollowDeal(String userEmail, UUID campaignId) {
        User user = requireUser(userEmail);
        followRepository.findByCampaignIdAndUserId(campaignId, user.getId()).ifPresent(followRepository::delete);
        return getDeal(campaignId, userEmail);
    }

    @Override
    @Transactional(readOnly = true)
    public List<GroupBuyCampaignDto> getFollowedDeals(String userEmail) {
        User user = requireUser(userEmail);
        return followRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(GroupBuyDealFollow::getCampaign)
                .filter(c -> PUBLIC_STATUSES.contains(c.getStatus()))
                .map(mapper::toCampaignDto)
                .toList();
    }

    // ----- My groups -------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<GroupBuyGroupDto> getMyGroups(String userEmail, String filter) {
        User user = requireUser(userEmail);
        String key = filter == null ? "all" : filter.trim().toLowerCase();
        Predicate<GroupBuyParticipant> predicate = switch (key) {
            case "active" -> p -> p.getStatus() == GroupBuyParticipantStatus.JOINED
                    && p.getBuyGroup().getStatus() == GroupBuyGroupStatus.OPEN;
            case "successful" -> p -> p.getStatus() == GroupBuyParticipantStatus.CONVERTED;
            case "started" -> p -> p.getBuyGroup().getStartedBy().getId().equals(user.getId());
            case "failed" -> p -> p.getStatus() == GroupBuyParticipantStatus.REFUNDED;
            case "left" -> p -> p.getStatus() == GroupBuyParticipantStatus.LEFT;
            default -> p -> true;
        };

        return participantRepository.findByUserIdOrderByJoinedAtDesc(user.getId()).stream()
                .filter(predicate)
                .map(p -> mapper.toGroupDto(p.getBuyGroup(), user, false))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public GroupBuyStatsDto getMyStats(String userEmail) {
        User user = requireUser(userEmail);
        List<GroupBuyParticipant> rows = participantRepository.findByUserIdOrderByJoinedAtDesc(user.getId());

        BigDecimal totalSavings = BigDecimal.ZERO;
        BigDecimal totalSpent = BigDecimal.ZERO;
        BigDecimal totalRefunded = BigDecimal.ZERO;
        List<GroupBuySavingsEntryDto> history = new ArrayList<>();

        for (GroupBuyParticipant p : rows) {
            totalRefunded = totalRefunded.add(p.getRefundAmount() != null ? p.getRefundAmount() : BigDecimal.ZERO);
            if (p.getStatus() != GroupBuyParticipantStatus.CONVERTED || p.getFinalUnitPrice() == null) {
                continue;
            }
            GroupBuyGroup group = p.getBuyGroup();
            GroupBuyCampaign campaign = group.getCampaign();
            BigDecimal spent = GroupBuyPricing.lineTotal(p.getFinalUnitPrice(), p.getQuantity());
            BigDecimal saved = GroupBuyPricing.lineTotal(
                    campaign.getBasePrice().subtract(p.getFinalUnitPrice()).max(BigDecimal.ZERO), p.getQuantity());
            totalSpent = totalSpent.add(spent);
            totalSavings = totalSavings.add(saved);

            List<String> images = campaign.getProduct().getImageUrls();
            history.add(GroupBuySavingsEntryDto.builder()
                    .groupId(group.getId())
                    .campaignId(campaign.getId())
                    .productName(campaign.getProduct().getName())
                    .productImageUrl(images != null && !images.isEmpty() ? images.get(0) : null)
                    .quantity(p.getQuantity())
                    .basePrice(campaign.getBasePrice())
                    .paidUnitPrice(p.getFinalUnitPrice())
                    .savings(saved)
                    .orderNumber(p.getOrder() != null ? p.getOrder().getOrderNumber() : null)
                    .completedAt(group.getCompletedAt())
                    .build());
        }

        long successful = rows.stream().filter(p -> p.getStatus() == GroupBuyParticipantStatus.CONVERTED).count();
        long failed = rows.stream().filter(p -> p.getStatus() == GroupBuyParticipantStatus.REFUNDED).count();
        BigDecimal regularTotal = history.stream()
                .map(entry -> GroupBuyPricing.lineTotal(entry.getBasePrice(), entry.getQuantity()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return GroupBuyStatsDto.builder()
                .totalParticipations(rows.size())
                .successRate(GroupBuyPricing.percentOf(successful, successful + failed))
                .unitsBought(history.stream().mapToLong(GroupBuySavingsEntryDto::getQuantity).sum())
                .regularPriceTotal(regularTotal)
                .averageDiscountPercent(regularTotal.signum() > 0
                        ? totalSavings.multiply(BigDecimal.valueOf(100)).divide(regularTotal, 1, RoundingMode.HALF_UP)
                        : BigDecimal.ZERO.setScale(1))
                .biggestSaving(history.stream()
                        .max(Comparator.comparing(GroupBuySavingsEntryDto::getSavings))
                        .filter(entry -> entry.getSavings().signum() > 0)
                        .orElse(null))
                .monthly(monthlySavings(history))
                .activeGroups(rows.stream().filter(p -> p.getStatus() == GroupBuyParticipantStatus.JOINED
                        && p.getBuyGroup().getStatus() == GroupBuyGroupStatus.OPEN).count())
                .successfulGroups(successful)
                .failedGroups(failed)
                .startedGroups(rows.stream().filter(p -> p.getBuyGroup().getStartedBy().getId().equals(user.getId())).count())
                .leftGroups(rows.stream().filter(p -> p.getStatus() == GroupBuyParticipantStatus.LEFT).count())
                .totalSavings(totalSavings)
                .totalSpent(totalSpent)
                .totalRefunded(totalRefunded)
                .successfulInvites(participantRepository.countByInvitedByIdAndStatusIn(user.getId(),
                        List.of(GroupBuyParticipantStatus.JOINED, GroupBuyParticipantStatus.CONVERTED)))
                .savingsHistory(history)
                .build();
    }

    // ----- Helpers ---------------------------------------------------------------------------

    private static List<GroupBuyStatsDto.MonthRow> monthlySavings(List<GroupBuySavingsEntryDto> history) {
        YearMonth current = YearMonth.now();
        Map<YearMonth, GroupBuyStatsDto.MonthRow> months = new LinkedHashMap<>();
        for (int i = 11; i >= 0; i--) {
            YearMonth month = current.minusMonths(i);
            months.put(month, GroupBuyStatsDto.MonthRow.builder()
                    .month(month.toString()).spent(BigDecimal.ZERO).savings(BigDecimal.ZERO).build());
        }
        BigDecimal cumulative = BigDecimal.ZERO;
        YearMonth first = current.minusMonths(11);
        for (GroupBuySavingsEntryDto entry : history) {
            if (entry.getCompletedAt() == null) {
                continue;
            }
            YearMonth month = YearMonth.from(entry.getCompletedAt());
            GroupBuyStatsDto.MonthRow row = months.get(month);
            if (row != null) {
                row.setGroups(row.getGroups() + 1);
                row.setSpent(row.getSpent().add(GroupBuyPricing.lineTotal(entry.getPaidUnitPrice(), entry.getQuantity())));
                row.setSavings(row.getSavings().add(entry.getSavings()));
            } else if (month.isBefore(first)) {
                cumulative = cumulative.add(entry.getSavings());
            }
        }
        for (GroupBuyStatsDto.MonthRow row : months.values()) {
            cumulative = cumulative.add(row.getSavings());
            row.setCumulativeSavings(cumulative);
        }
        return new ArrayList<>(months.values());
    }

    private void addParticipant(GroupBuyCampaign campaign, GroupBuyGroup group, User user,
                                JoinGroupBuyRequest request, Address address, User inviter,
                                GroupBuyParticipant existing) {
        int previousCount = group.getParticipantCount();
        int newCount = previousCount + 1;
        int quantity = request.getQuantity();
        BigDecimal previousPrice = GroupBuyPricing.unitPriceFor(campaign, previousCount);
        BigDecimal unitPrice = GroupBuyPricing.unitPriceFor(campaign, newCount);

        // Reuse the row if the user left earlier (unique group/user constraint)
        GroupBuyParticipant participant = existing != null ? existing : new GroupBuyParticipant();
        participant.setBuyGroup(group);
        participant.setUser(user);
        participant.setInvitedBy(inviter);
        participant.setQuantity(quantity);
        participant.setUnitPriceAtJoin(unitPrice);
        participant.setAmountPaid(GroupBuyPricing.lineTotal(unitPrice, quantity));
        participant.setFinalUnitPrice(null);
        participant.setRefundAmount(BigDecimal.ZERO);
        participant.setStatus(GroupBuyParticipantStatus.JOINED);
        participant.setPaymentStatus(PaymentStatus.COMPLETED); // sandbox payment captured at join
        participant.setPaymentMethod(request.getPaymentMethod());
        participant.setPaymentReference("txn_gb_" + UUID.randomUUID().toString().replace("-", "").substring(0, 20));
        participant.setOrder(null);
        participant.setShippingAddressLine1(address.getStreetAddress());
        participant.setShippingAddressLine2(address.getApartment());
        participant.setShippingCity(address.getCity());
        participant.setShippingState(address.getState());
        participant.setShippingPostalCode(address.getPostalCode());
        participant.setShippingCountry(address.getCountry());
        participant.setJoinedAt(LocalDateTime.now());
        participant.setLeftAt(null);
        participantRepository.save(participant);

        group.setParticipantCount(newCount);
        group.setTotalQuantity(group.getTotalQuantity() + quantity);
        campaign.setCommittedQuantity(campaign.getCommittedQuantity() + quantity);

        String link = groupLink(group.getId());
        String productName = shortText(campaign.getProduct().getName(), 60);
        List<GroupBuyParticipant> members = participantRepository
                .findByBuyGroupIdAndStatusOrderByJoinedAtAsc(group.getId(), GroupBuyParticipantStatus.JOINED);

        if (previousCount > 0) {
            events.activity(group, user, "MEMBER_JOINED",
                    displayName(user) + " joined with " + quantity + (quantity == 1 ? " unit" : " units"));
            int spotsLeft = Math.max(0, campaign.getMinParticipants() - newCount);
            String progress = spotsLeft > 0
                    ? newCount + " of " + campaign.getMinParticipants() + " needed."
                    : newCount + " members so far. The goal is reached.";
            // The inviter gets a dedicated "invite worked" message instead
            Set<UUID> excluded = inviter != null ? Set.of(user.getId(), inviter.getId()) : Set.of(user.getId());
            events.notifyMembersExcept(members, excluded, "New member joined your group",
                    displayName(user) + " joined your group for '" + productName + "'. " + progress,
                    "GROUP_BUY_JOIN", link);
        }
        if (inviter != null) {
            events.activity(group, inviter, "INVITE_JOINED",
                    displayName(inviter) + "'s invite brought in " + displayName(user));
            events.notify(inviter, "Your invite worked",
                    displayName(user) + " joined your group for '" + productName + "' using your invite.",
                    "GROUP_BUY_INVITE", link);
        }

        if (previousCount > 0 && unitPrice.compareTo(previousPrice) < 0) {
            String discount = GroupBuyPricing.discountPercent(campaign.getBasePrice(), unitPrice)
                    .stripTrailingZeros().toPlainString();
            events.activity(group, null, "TIER_UNLOCKED",
                    "New price unlocked: " + money(unitPrice) + " each (" + discount + "% off)");
            events.notifyMembers(members, user.getId(), "Price dropped!",
                    "Your group for '" + productName + "' unlocked " + money(unitPrice) + " each ("
                            + discount + "% off). You'll pay the lower price automatically.",
                    "GROUP_BUY_PRICE_DROP", link);
            dealAlerts.priceUnlocked(campaign, group, unitPrice);
        }

        int spotsToMinimum = campaign.getMinParticipants() - newCount;
        if (spotsToMinimum == 1 && !group.isAlmostThereNotified()) {
            group.setAlmostThereNotified(true);
            events.activity(group, null, "ALMOST_THERE", "Almost there! Just 1 more participant needed");
            events.notifyMembers(members, null, "Almost there!",
                    "Just 1 more person needed for your group on '" + productName + "'. Share invite code "
                            + group.getInviteCode() + ".",
                    "GROUP_BUY_ALMOST", link);
        } else if (spotsToMinimum == 0) {
            events.activity(group, null, "GOAL_REACHED", "Minimum group size reached. The deal is unlocked!");
            events.notifyMembers(members, null, "Group goal reached",
                    "Your group for '" + productName + "' reached its minimum size. Orders are placed when the timer ends.",
                    "GROUP_BUY_GOAL", link);
        }
    }

    private void settleIfFull(GroupBuyCampaign campaign, GroupBuyGroup group) {
        if (group.getParticipantCount() >= campaign.getMaxParticipants()) {
            lifecycleService.settleGroup(group.getId());
        }
    }

    private String startBlockedReason(GroupBuyCampaign campaign, User viewer, UUID myActiveGroupId, LocalDateTime now) {
        if (campaign.getStatus() == GroupBuyCampaignStatus.PAUSED) {
            return "This group buy is temporarily paused by the seller.";
        }
        if (campaign.getStatus() == GroupBuyCampaignStatus.SCHEDULED || campaign.getStartAt().isAfter(now)) {
            return "This group buy hasn't started yet.";
        }
        if (campaign.getStatus() != GroupBuyCampaignStatus.ACTIVE || !campaign.getEndAt().isAfter(now)) {
            return "This group buy has ended.";
        }
        if (campaign.getAvailableQuantity() <= 0) {
            return "All reserved units for this group buy are taken.";
        }
        if (viewer != null && isSellerOf(campaign, viewer)) {
            return "You can't join a group buy for your own product.";
        }
        if (myActiveGroupId != null) {
            return "You're already in an active group for this deal.";
        }
        if (Duration.between(now, campaign.getEndAt()).toMinutes() < MIN_GROUP_WINDOW_MINUTES) {
            return "This deal is ending too soon to start a new group.";
        }
        return null;
    }

    private void assertAcceptingParticipants(GroupBuyCampaign campaign, User user, LocalDateTime now) {
        if (campaign.getStatus() == GroupBuyCampaignStatus.PAUSED) {
            throw new ApiException("This group buy is temporarily paused by the seller", HttpStatus.BAD_REQUEST);
        }
        if (campaign.getStatus() != GroupBuyCampaignStatus.ACTIVE
                || campaign.getStartAt().isAfter(now) || !campaign.getEndAt().isAfter(now)) {
            throw new ApiException("This group buy is not accepting participants right now", HttpStatus.BAD_REQUEST);
        }
        if (isSellerOf(campaign, user)) {
            throw new ApiException("You can't join a group buy for your own product", HttpStatus.BAD_REQUEST);
        }
    }

    private void validateQuantity(GroupBuyCampaign campaign, Integer quantity) {
        if (quantity == null || quantity < 1 || quantity > campaign.getMaxQuantityPerUser()) {
            throw new ApiException("You can buy between 1 and " + campaign.getMaxQuantityPerUser()
                    + " unit(s) in this group buy", HttpStatus.BAD_REQUEST);
        }
        if (quantity > campaign.getAvailableQuantity()) {
            throw new ApiException("Only " + campaign.getAvailableQuantity() + " unit(s) are left in this group buy",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private void validatePaymentMethod(PaymentMethod method) {
        if (method == null || !ONLINE_PAYMENT_METHODS.contains(method)) {
            throw new ApiException("Group buys require an online payment method (card, PayPal or Stripe)",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private Address requireAddress(User user, UUID addressId) {
        return addressRepository.findByIdAndUserId(addressId, user.getId())
                .orElseThrow(() -> new ApiException("Select a valid shipping address", HttpStatus.BAD_REQUEST));
    }

    private User resolveInviter(UUID inviterId, User joiner, UUID groupId) {
        if (inviterId == null || inviterId.equals(joiner.getId())) {
            return null;
        }
        return participantRepository.findByBuyGroupIdAndUserId(groupId, inviterId)
                .map(GroupBuyParticipant::getUser)
                .orElse(null);
    }

    private boolean isSellerOf(GroupBuyCampaign campaign, User user) {
        return campaign.getSellerStore().getUser().getId().equals(user.getId());
    }

    private boolean matches(GroupBuyCampaign campaign, String needle) {
        return contains(campaign.getTitle(), needle)
                || contains(campaign.getProduct().getName(), needle)
                || contains(campaign.getDescription(), needle);
    }

    private static boolean contains(String value, String needle) {
        return value != null && value.toLowerCase().contains(needle);
    }

    private Comparator<GroupBuyCampaignDto> dealComparator(String sort) {
        String key = sort == null ? "popular" : sort.trim().toLowerCase();
        return switch (key) {
            case "ending_soon" -> Comparator.comparing(GroupBuyCampaignDto::getEndAt);
            case "discount" -> Comparator.comparing(GroupBuyCampaignDto::getMaxDiscountPercent).reversed();
            case "price_low" -> Comparator.comparing(GroupBuyCampaignDto::getLowestPrice);
            case "newest" -> Comparator.comparing(GroupBuyCampaignDto::getCreatedAt).reversed();
            default -> Comparator.comparingLong(GroupBuyCampaignDto::getTotalParticipants).reversed()
                    .thenComparing(GroupBuyCampaignDto::getEndAt);
        };
    }

    private String generateInviteCode() {
        String code;
        do {
            StringBuilder builder = new StringBuilder(INVITE_CODE_LENGTH);
            for (int i = 0; i < INVITE_CODE_LENGTH; i++) {
                builder.append(INVITE_ALPHABET.charAt(RANDOM.nextInt(INVITE_ALPHABET.length())));
            }
            code = builder.toString();
        } while (groupRepository.existsByInviteCode(code));
        return code;
    }

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    private User findViewer(String email) {
        return email == null ? null : userRepository.findByEmail(email).orElse(null);
    }
}
