package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.groupbuy.admin.*;
import com.groupmart.dto.order.OrderDto;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.GroupBuyAdminService;
import com.groupmart.service.GroupBuyLifecycleService;
import com.groupmart.service.OrderService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.groupmart.service.impl.GroupBuyAdminMapper.orZero;

@Service
@RequiredArgsConstructor
public class GroupBuyAdminServiceImpl implements GroupBuyAdminService {

    private static final int MAX_LIMIT = 500;
    private static final LocalDateTime ALL_TIME = LocalDateTime.of(2000, 1, 1, 0, 0);
    private static final Set<GroupBuyDisputeStatus> OPEN_DISPUTES =
            EnumSet.of(GroupBuyDisputeStatus.OPEN, GroupBuyDisputeStatus.UNDER_REVIEW);

    private final GroupBuyCampaignRepository campaignRepository;
    private final GroupBuyGroupRepository groupRepository;
    private final GroupBuyParticipantRepository participantRepository;
    private final GroupBuyActivityRepository activityRepository;
    private final GroupBuyDisputeRepository disputeRepository;
    private final GroupBuyFlagReviewRepository flagReviewRepository;
    private final InventoryLogRepository inventoryLogRepository;
    private final UserRepository userRepository;
    private final GroupBuyLifecycleService lifecycleService;
    private final OrderService orderService;
    private final GroupBuyFraudDetector fraudDetector;
    private final GroupBuyMapper mapper;
    private final GroupBuyAdminMapper adminMapper;
    private final GroupBuyAuditLogger audit;

    // ----- Overview ----------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public AdminGroupBuyOverviewDto getOverview() {
        Map<String, Long> campaigns = statusCounts(campaignRepository.countByStatus(), GroupBuyCampaignStatus.values());
        Map<String, Long> groups = statusCounts(groupRepository.countByStatus(), GroupBuyGroupStatus.values());

        long active = 0;
        long participations = 0;
        BigDecimal sales = BigDecimal.ZERO;
        BigDecimal refunds = BigDecimal.ZERO;
        for (Object[] row : participantRepository.aggregateByStatus()) {
            GroupBuyParticipantStatus status = (GroupBuyParticipantStatus) row[0];
            long count = ((Number) row[1]).longValue();
            BigDecimal paid = (BigDecimal) row[2];
            BigDecimal refunded = (BigDecimal) row[3];
            participations += count;
            refunds = refunds.add(refunded);
            if (status == GroupBuyParticipantStatus.JOINED) {
                active = count;
            } else if (status == GroupBuyParticipantStatus.CONVERTED) {
                sales = sales.add(paid.subtract(refunded));
            }
        }
        refunds = refunds.add(orZero(disputeRepository.sumAllRefunds()));

        Object[] held = campaignRepository.heldInventoryTotals().stream().findFirst().orElse(new Object[]{0, 0});
        long closedGroups = groups.get("SUCCESS") + groups.get("FAILED") + groups.get("CANCELLED");
        List<GroupBuyFraudFlagDto> flags = getFraudFlags(30, false);

        return AdminGroupBuyOverviewDto.builder()
                .campaignsByStatus(campaigns)
                .liveCampaigns(campaigns.get("ACTIVE"))
                .groupsByStatus(groups)
                .openGroups(groups.get("OPEN"))
                .groupSuccessRate(percent(groups.get("SUCCESS"), closedGroups))
                .activeParticipants(active)
                .totalParticipations(participations)
                .unitsReserved(((Number) held[0]).longValue())
                .unitsCommitted(((Number) held[1]).longValue())
                .unitsSold(campaignRepository.sumSoldQuantity().longValue())
                .grossSales(scale(sales))
                .refundsIssued(scale(refunds))
                .customerSavings(scale(orZero(participantRepository.sumCustomerSavings())))
                .openDisputes(disputeRepository.countByStatusIn(OPEN_DISPUTES))
                .openFraudFlags(flags.size())
                .highRiskFlags(flags.stream().filter(f -> GroupBuyFraudDetector.HIGH.equals(f.getSeverity())).count())
                .build();
    }

    // ----- Monitoring --------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<AdminGroupBuyParticipantDto> getParticipants(String status, String query, int limit) {
        int size = clampLimit(limit);
        String needle = query != null && !query.isBlank() ? query.trim().toLowerCase(Locale.ROOT) : null;
        // Search runs in memory, so scan a wider window before trimming to the requested size
        PageRequest page = PageRequest.of(0, needle != null ? MAX_LIMIT * 4 : size);
        List<GroupBuyParticipant> rows = status == null || status.isBlank() || "ALL".equalsIgnoreCase(status)
                ? participantRepository.findRecent(page)
                : participantRepository.findRecentByStatus(parseEnum(GroupBuyParticipantStatus.class, status), page);
        return rows.stream()
                .map(adminMapper::toParticipantDto)
                .filter(dto -> needle == null || matches(dto, needle))
                .limit(size)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminGroupBuyParticipantDto> getOrders(int limit) {
        return participantRepository.findRecentWithOrders(PageRequest.of(0, clampLimit(limit))).stream()
                .map(adminMapper::toParticipantDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminGroupBuyActivityDto> getActivity(int limit) {
        return activityRepository.findRecent(PageRequest.of(0, clampLimit(limit))).stream()
                .map(adminMapper::toActivityDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<GroupBuyInventoryLogDto> getInventoryLogs() {
        return inventoryLogRepository.findTop100ByReasonStartingWithOrderByCreatedAtDesc("GROUP_BUY").stream()
                .map(log -> GroupBuyInventoryLogDto.builder()
                        .id(log.getId())
                        .productId(log.getProduct().getId())
                        .productName(log.getProduct().getName())
                        .sellerStoreName(log.getSellerStore() != null ? log.getSellerStore().getStoreName() : null)
                        .previousQuantity(log.getPreviousQuantity())
                        .newQuantity(log.getNewQuantity())
                        .quantityChange(log.getQuantityChange())
                        .reason(log.getReason())
                        .campaignId(campaignIdFromReference(log.getReferenceId()))
                        .createdAt(log.getCreatedAt())
                        .build())
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public AdminGroupBuyGroupDetailDto getGroup(UUID groupId) {
        return groupDetail(requireGroup(groupId));
    }

    // ----- Moderation --------------------------------------------------------------------------

    @Override
    @Transactional
    public AdminGroupBuyGroupDetailDto cancelGroup(String adminEmail, UUID groupId, String reason) {
        GroupBuyGroup group = requireGroup(groupId);
        lifecycleService.cancelGroup(groupId, reason);
        audit.record(adminEmail, "GROUP_CANCEL", GroupBuyAuditLogger.GROUP,
                "Cancelled group " + group.getInviteCode() + " [" + groupId + "] with " + group.getParticipantCount()
                        + " member(s) refunded, in " + GroupBuyAuditLogger.describe(group.getCampaign())
                        + (reason != null && !reason.isBlank() ? ". Reason: " + reason.trim() : ""));
        return groupDetail(group);
    }

    @Override
    @Transactional
    public AdminGroupBuyGroupDetailDto removeMember(String adminEmail, UUID groupId, UUID userId, String reason) {
        GroupBuyGroup group = requireGroup(groupId);
        User member = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        lifecycleService.removeMember(groupId, userId, true, reason);
        audit.record(adminEmail, "MEMBER_REMOVE", GroupBuyAuditLogger.GROUP,
                "Removed " + member.getEmail() + " from group " + group.getInviteCode() + " [" + groupId + "] in "
                        + GroupBuyAuditLogger.describe(group.getCampaign())
                        + (reason != null && !reason.isBlank() ? ". Reason: " + reason.trim() : ""));
        return groupDetail(group);
    }

    // ----- Delivery board ----------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<OrderDto> getDeliveryBoard(String scope, String status, String query, int limit) {
        OrderType scopeType = deliveryScopeType(scope);
        String needle = query != null && !query.isBlank() ? query.trim().toLowerCase(Locale.ROOT) : null;
        Set<OrderStatus> statuses = deliveryStatuses(status);

        return orderService.getAllOrdersForAdmin().stream()
                .filter(order -> scopeType == null || order.getOrderType() == scopeType)
                .filter(order -> statuses.contains(order.getStatus()))
                .filter(order -> needle == null || matchesOrder(order, needle))
                .limit(clampLimit(limit))
                .toList();
    }

    /**
     * The order type a delivery scope narrows to. A blank scope keeps the historical group-buy
     * default; {@code ALL} and anything unrecognised mean "no order-type filter", so a typo can
     * never silently return a narrower board than the administrator asked for.
     */
    private static OrderType deliveryScopeType(String scope) {
        if (scope == null || scope.isBlank() || "GROUP_BUY".equalsIgnoreCase(scope)) {
            return OrderType.GROUP_BUY;
        }
        if ("ALL".equalsIgnoreCase(scope)) {
            return null;
        }
        for (OrderType type : OrderType.values()) {
            if (type.name().equalsIgnoreCase(scope)) {
                return type;
            }
        }
        return null;
    }

    /** Open orders by default: the ones whose delivery date a shopper is still waiting on. */
    private static Set<OrderStatus> deliveryStatuses(String status) {
        if (status == null || status.isBlank() || "OPEN".equalsIgnoreCase(status)) {
            return EnumSet.of(OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.SHIPPED);
        }
        if ("ALL".equalsIgnoreCase(status)) {
            return EnumSet.allOf(OrderStatus.class);
        }
        return EnumSet.of(parseEnum(OrderStatus.class, status));
    }

    private static boolean matchesOrder(OrderDto order, String needle) {
        return java.util.stream.Stream.of(order.getOrderNumber(), order.getUserEmail(), order.getUserName())
                .filter(Objects::nonNull)
                .anyMatch(value -> value.toLowerCase(Locale.ROOT).contains(needle));
    }

    // ----- Fraud flags -------------------------------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public List<GroupBuyFraudFlagDto> getFraudFlags(int days, boolean includeReviewed) {
        List<GroupBuyFraudFlagDto> flags = fraudDetector.detect(since(days));
        Map<String, GroupBuyFlagReview> reviews = flagReviewRepository
                .findByFlagKeyIn(flags.stream().map(GroupBuyFraudFlagDto::getKey).toList()).stream()
                .collect(Collectors.toMap(GroupBuyFlagReview::getFlagKey, Function.identity()));

        List<GroupBuyFraudFlagDto> visible = new ArrayList<>();
        for (GroupBuyFraudFlagDto flag : flags) {
            GroupBuyFlagReview review = reviews.get(flag.getKey());
            if (review != null) {
                attachReview(flag, review);
                boolean newEvidence = flag.getEvidenceCount() > review.getEvidenceCount();
                if (!includeReviewed && !newEvidence) {
                    continue;
                }
            }
            visible.add(flag);
        }
        return visible;
    }

    @Override
    @Transactional
    public GroupBuyFraudFlagDto reviewFlag(String adminEmail, GroupBuyFlagReviewRequest request, int days) {
        User admin = userRepository.findByEmail(adminEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", adminEmail));
        GroupBuyFraudFlagDto flag = fraudDetector.detect(since(days)).stream()
                .filter(f -> f.getKey().equals(request.getKey()))
                .findFirst()
                .orElseThrow(() -> new ApiException("This flag no longer applies. Refresh the list.", HttpStatus.NOT_FOUND));

        GroupBuyFlagReview review = flagReviewRepository.findByFlagKey(flag.getKey())
                .orElseGet(() -> GroupBuyFlagReview.builder().flagKey(flag.getKey()).build());
        review.setDecision(request.getDecision());
        review.setNote(request.getNote() != null && !request.getNote().isBlank() ? request.getNote().trim() : null);
        review.setEvidenceCount(flag.getEvidenceCount());
        review.setReviewedBy(admin);
        review = flagReviewRepository.saveAndFlush(review);
        attachReview(flag, review);

        audit.record(adminEmail, "FLAG_" + (request.getDecision() == GroupBuyFlagReview.Decision.DISMISSED ? "DISMISS" : "CONFIRM"),
                GroupBuyAuditLogger.FLAG, flag.getRuleLabel() + ": " + flag.getTitle() + " [" + flag.getKey() + "]"
                        + (review.getNote() != null ? ". Note: " + review.getNote() : ""));
        return flag;
    }

    // ----- Helpers -----------------------------------------------------------------------------

    private AdminGroupBuyGroupDetailDto groupDetail(GroupBuyGroup group) {
        GroupBuyCloseCode code = group.getStatus() == GroupBuyGroupStatus.OPEN || group.getStatus() == GroupBuyGroupStatus.SUCCESS
                ? null : GroupBuyCloseReasons.forGroup(group);
        return AdminGroupBuyGroupDetailDto.builder()
                .group(mapper.toGroupDto(group, null, true))
                .closeCode(code != null ? code.name() : null)
                .closeReasonLabel(code != null ? code.getLabel() : null)
                .members(participantRepository.findByBuyGroupIdOrderByJoinedAtAsc(group.getId()).stream()
                        .map(adminMapper::toParticipantDto)
                        .toList())
                .disputes(disputeRepository.findByGroupId(group.getId()).stream()
                        .map(adminMapper::toDisputeDto)
                        .toList())
                .build();
    }

    private static void attachReview(GroupBuyFraudFlagDto flag, GroupBuyFlagReview review) {
        flag.setReviewDecision(review.getDecision().name());
        flag.setReviewNote(review.getNote());
        flag.setReviewedByName(GroupBuyAdminMapper.fullName(review.getReviewedBy()));
        flag.setReviewedAt(review.getUpdatedAt() != null ? review.getUpdatedAt()
                : review.getCreatedAt() != null ? review.getCreatedAt() : LocalDateTime.now());
    }

    private static boolean matches(AdminGroupBuyParticipantDto dto, String needle) {
        return java.util.stream.Stream.of(dto.getCustomerName(), dto.getCustomerEmail(), dto.getCampaignTitle(),
                        dto.getProductName(), dto.getSellerStoreName(), dto.getInviteCode(), dto.getOrderNumber(),
                        dto.getPaymentReference())
                .filter(Objects::nonNull)
                .anyMatch(value -> value.toLowerCase(Locale.ROOT).contains(needle));
    }

    private static <E extends Enum<E>> Map<String, Long> statusCounts(List<Object[]> rows, E[] values) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (E value : values) {
            counts.put(value.name(), 0L);
        }
        for (Object[] row : rows) {
            counts.put(((Enum<?>) row[0]).name(), ((Number) row[1]).longValue());
        }
        return counts;
    }

    private GroupBuyGroup requireGroup(UUID groupId) {
        return groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("GroupBuyGroup", "id", groupId));
    }

    private static UUID campaignIdFromReference(String reference) {
        if (reference == null || !reference.startsWith("GROUP_BUY:")) {
            return null;
        }
        try {
            return UUID.fromString(reference.substring("GROUP_BUY:".length()));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static LocalDateTime since(int days) {
        return days > 0 ? LocalDateTime.now().minusDays(days) : ALL_TIME;
    }

    private static int clampLimit(int limit) {
        return limit <= 0 ? 100 : Math.min(limit, MAX_LIMIT);
    }

    private static BigDecimal percent(long part, long whole) {
        return whole <= 0 ? BigDecimal.ZERO
                : BigDecimal.valueOf(part * 100.0 / whole).setScale(1, RoundingMode.HALF_UP);
    }

    private static BigDecimal scale(BigDecimal value) {
        return orZero(value).setScale(2, RoundingMode.HALF_UP);
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> type, String value) {
        try {
            return Enum.valueOf(type, value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ApiException("Unknown status: " + value, HttpStatus.BAD_REQUEST);
        }
    }
}
