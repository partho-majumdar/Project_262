package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.groupmart.common.exception.ApiException;
import com.groupmart.common.exception.ResourceNotFoundException;
import com.groupmart.dto.groupbuy.analytics.GroupBuyAnalyticsDto;
import com.groupmart.dto.groupbuy.analytics.GroupBuyAnalyticsDto.*;
import com.groupmart.entity.*;
import com.groupmart.repository.*;
import com.groupmart.service.GroupBuyAnalyticsService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.groupmart.service.impl.GroupBuyAdminMapper.orZero;

@Service
@RequiredArgsConstructor
public class GroupBuyAnalyticsServiceImpl implements GroupBuyAnalyticsService {

    /** Daily trend rows are capped so an all-time report stays readable. */
    private static final int MAX_TREND_DAYS = 90;
    private static final LocalDateTime ALL_TIME = LocalDateTime.of(2000, 1, 1, 0, 0);
    /** A discount band needs this many closed groups before it can be called the best performer. */
    private static final int MIN_BAND_SAMPLE = 3;
    private static final int ID_CHUNK = 1000;
    private static final int PLATFORM_CAMPAIGN_ROWS = 100;
    private static final int PRODUCT_ROWS = 50;
    private static final Set<GroupBuyCampaignStatus> NOT_LAUNCHED = EnumSet.of(GroupBuyCampaignStatus.DRAFT);
    private static final Set<GroupBuyCampaignStatus> RUNNING = EnumSet.of(
            GroupBuyCampaignStatus.SCHEDULED, GroupBuyCampaignStatus.ACTIVE, GroupBuyCampaignStatus.PAUSED);

    private static final List<Band> BANDS = List.of(
            new Band("UNDER_10", "Under 10% off", 0),
            new Band("10_TO_19", "10–19% off", 10),
            new Band("20_TO_29", "20–29% off", 20),
            new Band("30_TO_39", "30–39% off", 30),
            new Band("40_PLUS", "40% off or more", 40));

    private final GroupBuyCampaignRepository campaignRepository;
    private final GroupBuyGroupRepository groupRepository;
    private final GroupBuyParticipantRepository participantRepository;
    private final GroupBuyDisputeRepository disputeRepository;
    private final SellerStoreRepository sellerStoreRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public GroupBuyAnalyticsDto getPlatformAnalytics(int days) {
        return build(null, days);
    }

    @Override
    @Transactional(readOnly = true)
    public GroupBuyAnalyticsDto getSellerAnalytics(String sellerEmail, int days) {
        User user = userRepository.findByEmail(sellerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", sellerEmail));
        SellerStore store = sellerStoreRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ApiException("Create your seller store before viewing group buy analytics",
                        HttpStatus.BAD_REQUEST));
        return build(store, days);
    }

    // ----- Assembly ----------------------------------------------------------------------------

    private GroupBuyAnalyticsDto build(SellerStore store, int days) {
        boolean platform = store == null;
        LocalDateTime since = days > 0 ? LocalDateTime.now().minusDays(days) : ALL_TIME;

        List<GroupBuyCampaign> campaigns = platform
                ? campaignRepository.findAllWithStore()
                : campaignRepository.findByStoreWithProduct(store.getId());
        List<GroupBuyGroup> touched = platform
                ? groupRepository.findTouchedSince(since)
                : groupRepository.findTouchedSinceForStore(since, store.getId());
        List<GroupBuyParticipant> joins = platform
                ? participantRepository.findJoinedSince(since)
                : participantRepository.findJoinedSinceForStore(since, store.getId());

        List<GroupBuyGroup> started = touched.stream().filter(g -> !g.getCreatedAt().isBefore(since)).toList();
        List<GroupBuyGroup> closed = touched.stream()
                .filter(g -> g.getStatus() != GroupBuyGroupStatus.OPEN)
                .filter(g -> g.getCompletedAt() != null && !g.getCompletedAt().isBefore(since))
                .toList();
        Map<UUID, List<GroupBuyParticipant>> membersByGroup = membersByGroup(closed);
        Map<UUID, BigDecimal> disputeRefunds = disputeRefunds(membersByGroup.values().stream()
                .flatMap(List::stream).map(GroupBuyParticipant::getId).toList());
        Window window = new Window(started, closed, membersByGroup, disputeRefunds, joins);

        Tally total = window.total();
        Set<UUID> active = window.tallyBy(GroupBuyCampaign::getId).keySet();
        List<GroupBuyCampaign> reported = campaigns.stream()
                .filter(c -> !NOT_LAUNCHED.contains(c.getStatus()))
                .filter(c -> RUNNING.contains(c.getStatus())
                        || active.contains(c.getId())
                        || (c.getClosedAt() != null && !c.getClosedAt().isBefore(since)))
                .toList();

        return GroupBuyAnalyticsDto.builder()
                .scope(platform ? GroupBuyAnalyticsDto.PLATFORM : GroupBuyAnalyticsDto.SELLER)
                .storeId(platform ? null : store.getId())
                .storeName(platform ? null : store.getStoreName())
                .days(Math.max(0, days))
                .since(days > 0 ? since : null)
                .generatedAt(LocalDateTime.now())
                .summary(summary(total, window, campaigns, platform ? null : store.getId(), since, !platform))
                .campaignOutcomes(campaignOutcomes(campaigns, since))
                .failureReasons(failureReasons(window))
                .campaignCancellations(campaignCancellations(campaigns, since))
                .daily(dailyRows(days, window))
                .discountBands(discountBands(window))
                .products(productRows(window, reported))
                .campaigns(campaignRows(window, reported, !platform))
                .sellers(platform ? sellerRows(window, reported) : null)
                .build();
    }

    private Summary summary(Tally t, Window window, List<GroupBuyCampaign> campaigns, UUID storeId,
                            LocalDateTime since, boolean includeCost) {
        Object[] open = (storeId == null ? groupRepository.openTotals() : groupRepository.openTotalsForStore(storeId))
                .stream().findFirst().orElse(new Object[]{0, 0});

        long reserved = 0;
        long committed = 0;
        long endedReserved = 0;
        long endedSold = 0;
        for (GroupBuyCampaign c : campaigns) {
            if (c.isInventoryReserved() && !c.isInventoryReleased()) {
                reserved += c.getReservedQuantity();
                committed += c.getCommittedQuantity();
            }
            if (c.getStatus().isTerminal() && c.isInventoryReserved()
                    && c.getClosedAt() != null && !c.getClosedAt().isBefore(since)) {
                endedReserved += c.getReservedQuantity();
                endedSold += c.getSoldQuantity();
            }
        }

        Map<UUID, Long> joinsByCustomer = window.joins.stream()
                .collect(Collectors.groupingBy(p -> p.getUser().getId(), Collectors.counting()));

        Summary.SummaryBuilder summary = Summary.builder()
                .groupsStarted(t.groupsStarted)
                .groupsClosed(t.closed())
                .groupsSucceeded(t.succeeded)
                .groupsFailed(t.failed)
                .groupsCancelled(t.cancelled)
                .successRate(percent(t.succeeded, t.closed()))
                .failureRate(percent(t.failed + t.cancelled, t.closed()))
                .participantsJoined(t.joins)
                .uniqueCustomers(joinsByCustomer.size())
                .repeatCustomers(joinsByCustomer.values().stream().filter(n -> n > 1).count())
                .inviteJoins(t.inviteJoins)
                .inviteShare(percent(t.inviteJoins, t.joins))
                .closedGroupMembers(t.closedMembers)
                .convertedMembers(t.converted)
                .conversionRate(percent(t.converted, t.closedMembers))
                .averageGroupSize(t.averageGroupSize())
                .averageClosedGroupSize(average(t.stayedMembers, t.closed()))
                .unitsSold(t.unitsSold)
                .expectedRevenue(money(t.expected))
                .revenue(money(t.revenue))
                .lostToFailedGroups(money(t.lostToFailed))
                .lostToLeaves(money(t.lostToLeaves))
                .priceDropRefunds(money(t.priceDropRefunds))
                .disputeRefunds(money(t.disputeRefunds))
                .refunds(money(t.refunds()))
                .realizationRate(percent(t.revenue, t.expected))
                .regularPriceValue(money(t.regularValue))
                .customerSavings(money(t.savings))
                .averageDiscountPercent(percent(t.savings, t.regularValue))
                .liveCampaigns(campaigns.stream().filter(c -> c.getStatus() == GroupBuyCampaignStatus.ACTIVE).count())
                .openGroups(((Number) open[0]).longValue())
                .activeParticipants(((Number) open[1]).longValue())
                .unitsReservedHeld(reserved)
                .unitsCommittedHeld(committed)
                .unitsAvailableHeld(Math.max(0, reserved - committed))
                .sellThroughRate(percent(endedSold, endedReserved));
        if (includeCost && (t.hasCost || campaigns.stream().anyMatch(c -> c.getUnitCost() != null))) {
            summary.cost(money(t.cost))
                    .profit(money(t.profit()))
                    .marginPercent(percent(t.profit(), t.costedRevenue))
                    .costCoverage(percent(t.costedRevenue, t.revenue));
        }
        return summary.build();
    }

    private static Map<String, Long> campaignOutcomes(List<GroupBuyCampaign> campaigns, LocalDateTime since) {
        Map<String, Long> outcomes = new LinkedHashMap<>();
        for (GroupBuyCampaignStatus status : List.of(GroupBuyCampaignStatus.SUCCESS, GroupBuyCampaignStatus.FAILED,
                GroupBuyCampaignStatus.CANCELLED)) {
            outcomes.put(status.name(), campaigns.stream()
                    .filter(c -> c.getStatus() == status && c.getClosedAt() != null && !c.getClosedAt().isBefore(since))
                    .count());
        }
        return outcomes;
    }

    private static List<ReasonRow> failureReasons(Window window) {
        List<GroupBuyGroup> unsuccessful = window.closed.stream()
                .filter(g -> g.getStatus() != GroupBuyGroupStatus.SUCCESS)
                .toList();
        return unsuccessful.stream()
                .collect(Collectors.groupingBy(GroupBuyCloseReasons::forGroup,
                        () -> new EnumMap<>(GroupBuyCloseCode.class), Collectors.toList()))
                .entrySet().stream()
                .map(entry -> {
                    List<GroupBuyParticipant> members = entry.getValue().stream()
                            .flatMap(g -> window.members(g).stream())
                            .toList();
                    return ReasonRow.builder()
                            .code(entry.getKey().name())
                            .label(entry.getKey().getLabel())
                            .count(entry.getValue().size())
                            .participantsAffected(members.stream()
                                    .filter(p -> p.getStatus() == GroupBuyParticipantStatus.REFUNDED).count())
                            .refunded(money(members.stream().map(p -> orZero(p.getRefundAmount()))
                                    .reduce(BigDecimal.ZERO, BigDecimal::add)))
                            .percent(percent(entry.getValue().size(), unsuccessful.size()))
                            .build();
                })
                .sorted(Comparator.comparingLong(ReasonRow::getCount).reversed())
                .toList();
    }

    private static List<ReasonRow> campaignCancellations(List<GroupBuyCampaign> campaigns, LocalDateTime since) {
        List<GroupBuyCampaign> cancelled = campaigns.stream()
                .filter(c -> c.getStatus() == GroupBuyCampaignStatus.CANCELLED)
                .filter(c -> c.getClosedAt() != null && !c.getClosedAt().isBefore(since))
                .toList();
        return cancelled.stream()
                .collect(Collectors.groupingBy(GroupBuyCloseReasons::forCampaign,
                        () -> new EnumMap<>(GroupBuyCloseCode.class), Collectors.counting()))
                .entrySet().stream()
                .map(entry -> ReasonRow.builder()
                        .code(entry.getKey().name())
                        .label(entry.getKey().getLabel())
                        .count(entry.getValue())
                        .percent(percent(entry.getValue(), cancelled.size()))
                        .build())
                .sorted(Comparator.comparingLong(ReasonRow::getCount).reversed())
                .toList();
    }

    private static List<DayRow> dailyRows(int days, Window window) {
        LocalDate today = LocalDate.now();
        int span = days > 0 ? Math.min(days, MAX_TREND_DAYS) : MAX_TREND_DAYS;
        LocalDate first = today.minusDays(span - 1L);
        Map<LocalDate, DayRow> rows = new TreeMap<>();
        for (LocalDate day = first; !day.isAfter(today); day = day.plusDays(1)) {
            rows.put(day, DayRow.builder().date(day)
                    .revenue(BigDecimal.ZERO).refunds(BigDecimal.ZERO).savings(BigDecimal.ZERO).build());
        }

        window.started.forEach(g -> Optional.ofNullable(rows.get(g.getCreatedAt().toLocalDate()))
                .ifPresent(row -> row.setGroupsStarted(row.getGroupsStarted() + 1)));
        long joinedBeforeTrend = 0;
        for (GroupBuyParticipant p : window.joins) {
            DayRow row = rows.get(p.getJoinedAt().toLocalDate());
            if (row != null) {
                row.setParticipantsJoined(row.getParticipantsJoined() + 1);
            } else if (p.getJoinedAt().toLocalDate().isBefore(first)) {
                joinedBeforeTrend++;
            }
        }
        for (GroupBuyGroup group : window.closed) {
            DayRow row = rows.get(group.getCompletedAt().toLocalDate());
            if (row == null) {
                continue;
            }
            Tally tally = new Tally();
            tally.addClosedGroup(group, window.members(group), window.disputeRefunds);
            row.setGroupsSucceeded(row.getGroupsSucceeded() + tally.succeeded);
            row.setGroupsFailed(row.getGroupsFailed() + tally.failed + tally.cancelled);
            row.setRevenue(row.getRevenue().add(tally.revenue));
            row.setRefunds(row.getRefunds().add(tally.refunds()));
            row.setSavings(row.getSavings().add(tally.savings));
        }

        long cumulative = joinedBeforeTrend;
        for (DayRow row : rows.values()) {
            cumulative += row.getParticipantsJoined();
            row.setCumulativeParticipants(cumulative);
            row.setRevenue(money(row.getRevenue()));
            row.setRefunds(money(row.getRefunds()));
            row.setSavings(money(row.getSavings()));
        }
        return new ArrayList<>(rows.values());
    }

    private static List<DiscountBandRow> discountBands(Window window) {
        Map<String, Tally> tallies = new HashMap<>();
        Map<String, Set<UUID>> campaignsByBand = new HashMap<>();
        for (GroupBuyGroup group : window.closed) {
            String band = band(group.getCampaign()).code;
            tallies.computeIfAbsent(band, b -> new Tally()).addClosedGroup(group, window.members(group), window.disputeRefunds);
            campaignsByBand.computeIfAbsent(band, b -> new HashSet<>()).add(group.getCampaign().getId());
        }

        List<DiscountBandRow> rows = BANDS.stream()
                .map(band -> {
                    Tally t = tallies.getOrDefault(band.code, new Tally());
                    return DiscountBandRow.builder()
                            .band(band.code)
                            .label(band.label)
                            .minPercent(band.minPercent)
                            .campaigns(campaignsByBand.getOrDefault(band.code, Set.of()).size())
                            .groupsClosed(t.closed())
                            .groupsSucceeded(t.succeeded)
                            .successRate(percent(t.succeeded, t.closed()))
                            .averageGroupSize(t.averageGroupSize())
                            .unitsSold(t.unitsSold)
                            .revenue(money(t.revenue))
                            .customerSavings(money(t.savings))
                            .build();
                })
                .toList();
        rows.stream()
                .filter(r -> r.getGroupsClosed() >= MIN_BAND_SAMPLE)
                .max(Comparator.comparing(DiscountBandRow::getSuccessRate).thenComparing(DiscountBandRow::getRevenue))
                .ifPresent(best -> best.setBest(true));
        return rows;
    }

    private static List<ProductRow> productRows(Window window, List<GroupBuyCampaign> reported) {
        Map<UUID, Tally> tallies = window.tallyBy(c -> c.getProduct().getId());
        Map<UUID, List<GroupBuyCampaign>> campaignsByProduct = reported.stream()
                .collect(Collectors.groupingBy(c -> c.getProduct().getId()));
        return tallies.entrySet().stream()
                .map(entry -> {
                    Tally t = entry.getValue();
                    Product product = t.anyCampaign.getProduct();
                    List<String> images = product.getImageUrls();
                    return ProductRow.builder()
                            .productId(product.getId())
                            .productName(product.getName())
                            .productImageUrl(images != null && !images.isEmpty() ? images.get(0) : null)
                            .storeName(t.anyCampaign.getSellerStore().getStoreName())
                            .campaigns(campaignsByProduct.getOrDefault(entry.getKey(), List.of()).size())
                            .joins(t.joins)
                            .groupsSucceeded(t.succeeded)
                            .groupsFailed(t.failed + t.cancelled)
                            .successRate(percent(t.succeeded, t.closed()))
                            .unitsSold(t.unitsSold)
                            .revenue(money(t.revenue))
                            .customerSavings(money(t.savings))
                            .build();
                })
                .sorted(Comparator.comparingLong(ProductRow::getUnitsSold).reversed()
                        .thenComparing(ProductRow::getRevenue, Comparator.reverseOrder())
                        .thenComparing(Comparator.comparingLong(ProductRow::getJoins).reversed()))
                .limit(PRODUCT_ROWS)
                .toList();
    }

    private static List<CampaignRow> campaignRows(Window window, List<GroupBuyCampaign> reported, boolean includeCost) {
        Map<UUID, Tally> tallies = window.tallyBy(GroupBuyCampaign::getId);
        return reported.stream()
                .map(campaign -> {
                    Tally t = tallies.getOrDefault(campaign.getId(), new Tally());
                    BigDecimal lowest = GroupBuyPricing.lowestPrice(campaign);
                    CampaignRow.CampaignRowBuilder row = CampaignRow.builder()
                            .campaignId(campaign.getId())
                            .title(campaign.getTitle())
                            .productId(campaign.getProduct().getId())
                            .productName(campaign.getProduct().getName())
                            .storeId(campaign.getSellerStore().getId())
                            .storeName(campaign.getSellerStore().getStoreName())
                            .status(campaign.getStatus().name())
                            .basePrice(campaign.getBasePrice())
                            .lowestPrice(lowest)
                            .maxDiscountPercent(GroupBuyPricing.discountPercent(campaign.getBasePrice(), lowest))
                            .minParticipants(campaign.getMinParticipants())
                            .maxParticipants(campaign.getMaxParticipants())
                            .startAt(campaign.getStartAt())
                            .endAt(campaign.getEndAt())
                            .groupsStarted(t.groupsStarted)
                            .groupsSucceeded(t.succeeded)
                            .groupsFailed(t.failed + t.cancelled)
                            .successRate(percent(t.succeeded, t.closed()))
                            .joins(t.joins)
                            .closedGroupMembers(t.closedMembers)
                            .convertedMembers(t.converted)
                            .conversionRate(percent(t.converted, t.closedMembers))
                            .averageGroupSize(t.averageGroupSize())
                            .unitsSold(t.unitsSold)
                            .reservedQuantity(campaign.getReservedQuantity())
                            .sellThroughRate(percent(campaign.getSoldQuantity(), campaign.getReservedQuantity()))
                            .expectedRevenue(money(t.expected))
                            .revenue(money(t.revenue))
                            .refunds(money(t.refunds()))
                            .customerSavings(money(t.savings))
                            .topFailureReason(t.topFailureReason())
                            .tiers(tierRows(campaign, window));
                    if (includeCost && campaign.getUnitCost() != null) {
                        row.unitCost(campaign.getUnitCost())
                                .cost(money(t.cost))
                                .profit(money(t.profit()))
                                .marginPercent(t.converted > 0 ? percent(t.profit(), t.costedRevenue) : null);
                    }
                    return row.build();
                })
                .sorted(Comparator.comparing(CampaignRow::getRevenue).reversed()
                        .thenComparing(Comparator.comparingLong(CampaignRow::getJoins).reversed()))
                .limit(includeCost ? Long.MAX_VALUE : PLATFORM_CAMPAIGN_ROWS)
                .toList();
    }

    private static List<TierRow> tierRows(GroupBuyCampaign campaign, Window window) {
        List<GroupBuyPriceTier> tiers = GroupBuyPricing.sortedTiers(campaign);
        long[] endedHere = new long[tiers.size()];
        window.closed.stream()
                .filter(g -> g.getStatus() == GroupBuyGroupStatus.SUCCESS && g.getCampaign().getId().equals(campaign.getId()))
                .forEach(g -> {
                    for (int i = tiers.size() - 1; i >= 0; i--) {
                        if (g.getParticipantCount() >= tiers.get(i).getMinParticipants()) {
                            endedHere[i]++;
                            break;
                        }
                    }
                });
        long most = Arrays.stream(endedHere).max().orElse(0);
        List<TierRow> rows = new ArrayList<>();
        for (int i = 0; i < tiers.size(); i++) {
            GroupBuyPriceTier tier = tiers.get(i);
            rows.add(TierRow.builder()
                    .minParticipants(tier.getMinParticipants())
                    .unitPrice(tier.getUnitPrice())
                    .discountPercent(GroupBuyPricing.discountPercent(campaign.getBasePrice(), tier.getUnitPrice()))
                    .groupsEndedHere(endedHere[i])
                    .mostReached(most > 0 && endedHere[i] == most)
                    .build());
        }
        return rows;
    }

    private static List<SellerRow> sellerRows(Window window, List<GroupBuyCampaign> reported) {
        Map<UUID, Tally> tallies = window.tallyBy(c -> c.getSellerStore().getId());
        Map<UUID, List<GroupBuyCampaign>> campaignsByStore = reported.stream()
                .collect(Collectors.groupingBy(c -> c.getSellerStore().getId(), LinkedHashMap::new, Collectors.toList()));

        Set<UUID> storeIds = new LinkedHashSet<>(campaignsByStore.keySet());
        storeIds.addAll(tallies.keySet());
        List<SellerRow> rows = storeIds.stream()
                .map(storeId -> {
                    Tally t = tallies.getOrDefault(storeId, new Tally());
                    List<GroupBuyCampaign> storeCampaigns = campaignsByStore.getOrDefault(storeId, List.of());
                    SellerStore store = !storeCampaigns.isEmpty() ? storeCampaigns.get(0).getSellerStore()
                            : t.anyCampaign.getSellerStore();
                    return SellerRow.builder()
                            .storeId(storeId)
                            .storeName(store.getStoreName())
                            .campaigns(storeCampaigns.size())
                            .liveCampaigns(storeCampaigns.stream()
                                    .filter(c -> c.getStatus() == GroupBuyCampaignStatus.ACTIVE).count())
                            .groupsSucceeded(t.succeeded)
                            .groupsFailed(t.failed + t.cancelled)
                            .successRate(percent(t.succeeded, t.closed()))
                            .conversionRate(percent(t.converted, t.closedMembers))
                            .buyers(t.converted)
                            .averageGroupSize(t.averageGroupSize())
                            .unitsSold(t.unitsSold)
                            .revenue(money(t.revenue))
                            .customerSavings(money(t.savings))
                            .refunds(money(t.refunds()))
                            .build();
                })
                .sorted(Comparator.comparing(SellerRow::getRevenue).reversed()
                        .thenComparing(SellerRow::getSuccessRate, Comparator.reverseOrder())
                        .thenComparing(Comparator.comparingLong(SellerRow::getBuyers).reversed()))
                .toList();
        for (int i = 0; i < rows.size(); i++) {
            rows.get(i).setRank(i + 1);
        }
        return rows;
    }

    // ----- Loading -----------------------------------------------------------------------------

    private Map<UUID, List<GroupBuyParticipant>> membersByGroup(List<GroupBuyGroup> groups) {
        Map<UUID, List<GroupBuyParticipant>> members = new HashMap<>();
        chunks(groups.stream().map(GroupBuyGroup::getId).toList()).forEach(ids ->
                participantRepository.findByGroupIds(ids)
                        .forEach(p -> members.computeIfAbsent(p.getBuyGroup().getId(), id -> new ArrayList<>()).add(p)));
        return members;
    }

    private Map<UUID, BigDecimal> disputeRefunds(List<UUID> participantIds) {
        Map<UUID, BigDecimal> refunds = new HashMap<>();
        chunks(participantIds).forEach(ids -> disputeRepository.sumRefundsByParticipantIds(ids)
                .forEach(row -> refunds.put((UUID) row[0], (BigDecimal) row[1])));
        return refunds;
    }

    private static <T> List<List<T>> chunks(List<T> items) {
        List<List<T>> chunks = new ArrayList<>();
        for (int i = 0; i < items.size(); i += ID_CHUNK) {
            chunks.add(items.subList(i, Math.min(items.size(), i + ID_CHUNK)));
        }
        return chunks;
    }

    // ----- Aggregation -------------------------------------------------------------------------

    /** Everything loaded for one report window. */
    private record Window(List<GroupBuyGroup> started,
                          List<GroupBuyGroup> closed,
                          Map<UUID, List<GroupBuyParticipant>> membersByGroup,
                          Map<UUID, BigDecimal> disputeRefunds,
                          List<GroupBuyParticipant> joins) {

        List<GroupBuyParticipant> members(GroupBuyGroup group) {
            return membersByGroup.getOrDefault(group.getId(), List.of());
        }

        Tally total() {
            Tally tally = new Tally();
            started.forEach(tally::addStartedGroup);
            closed.forEach(g -> tally.addClosedGroup(g, members(g), disputeRefunds));
            joins.forEach(tally::addJoin);
            return tally;
        }

        <K> Map<K, Tally> tallyBy(Function<GroupBuyCampaign, K> key) {
            Map<K, Tally> tallies = new LinkedHashMap<>();
            started.forEach(g -> tallies.computeIfAbsent(key.apply(g.getCampaign()), k -> new Tally()).addStartedGroup(g));
            closed.forEach(g -> tallies.computeIfAbsent(key.apply(g.getCampaign()), k -> new Tally())
                    .addClosedGroup(g, members(g), disputeRefunds));
            joins.forEach(p -> tallies.computeIfAbsent(key.apply(p.getBuyGroup().getCampaign()), k -> new Tally()).addJoin(p));
            return tallies;
        }
    }

    /** Running totals for any slice of a window: the whole scope, one campaign, product, store or discount band. */
    private static final class Tally {
        GroupBuyCampaign anyCampaign;
        long groupsStarted;
        long succeeded;
        long failed;
        long cancelled;
        long successfulGroupMembers;
        long closedMembers;
        long stayedMembers;
        long converted;
        long unitsSold;
        long joins;
        long inviteJoins;
        BigDecimal expected = BigDecimal.ZERO;
        BigDecimal revenue = BigDecimal.ZERO;
        BigDecimal lostToFailed = BigDecimal.ZERO;
        BigDecimal lostToLeaves = BigDecimal.ZERO;
        BigDecimal priceDropRefunds = BigDecimal.ZERO;
        BigDecimal disputeRefunds = BigDecimal.ZERO;
        BigDecimal regularValue = BigDecimal.ZERO;
        BigDecimal savings = BigDecimal.ZERO;
        BigDecimal costedRevenue = BigDecimal.ZERO;
        BigDecimal cost = BigDecimal.ZERO;
        boolean hasCost;
        final Map<GroupBuyCloseCode, Long> failureCodes = new EnumMap<>(GroupBuyCloseCode.class);

        void addStartedGroup(GroupBuyGroup group) {
            anyCampaign = group.getCampaign();
            groupsStarted++;
        }

        void addJoin(GroupBuyParticipant participant) {
            anyCampaign = participant.getBuyGroup().getCampaign();
            joins++;
            if (participant.getInvitedBy() != null) {
                inviteJoins++;
            }
        }

        void addClosedGroup(GroupBuyGroup group, List<GroupBuyParticipant> members, Map<UUID, BigDecimal> disputes) {
            GroupBuyCampaign campaign = group.getCampaign();
            anyCampaign = campaign;
            switch (group.getStatus()) {
                case SUCCESS -> {
                    succeeded++;
                    successfulGroupMembers += group.getParticipantCount();
                }
                case FAILED -> failed++;
                default -> cancelled++;
            }
            if (group.getStatus() != GroupBuyGroupStatus.SUCCESS) {
                failureCodes.merge(GroupBuyCloseReasons.forGroup(group), 1L, Long::sum);
            }
            if (campaign.getUnitCost() != null) {
                hasCost = true;
            }

            for (GroupBuyParticipant member : members) {
                BigDecimal paid = orZero(member.getAmountPaid());
                BigDecimal refund = orZero(member.getRefundAmount());
                closedMembers++;
                expected = expected.add(paid);
                if (member.getStatus() != GroupBuyParticipantStatus.LEFT) {
                    stayedMembers++;
                }
                switch (member.getStatus()) {
                    case CONVERTED -> addConverted(campaign, member, paid, refund, orZero(disputes.get(member.getId())));
                    case LEFT -> lostToLeaves = lostToLeaves.add(refund);
                    case REFUNDED -> lostToFailed = lostToFailed.add(refund);
                    default -> {
                        // JOINED members only exist in open groups
                    }
                }
            }
        }

        private void addConverted(GroupBuyCampaign campaign, GroupBuyParticipant member, BigDecimal paid,
                                  BigDecimal refund, BigDecimal disputeRefund) {
            int quantity = member.getQuantity();
            BigDecimal kept = paid.subtract(refund).subtract(disputeRefund).max(BigDecimal.ZERO);
            converted++;
            unitsSold += quantity;
            revenue = revenue.add(kept);
            priceDropRefunds = priceDropRefunds.add(refund);
            disputeRefunds = disputeRefunds.add(disputeRefund);
            regularValue = regularValue.add(campaign.getBasePrice().multiply(BigDecimal.valueOf(quantity)));
            if (member.getFinalUnitPrice() != null) {
                savings = savings.add(campaign.getBasePrice().subtract(member.getFinalUnitPrice()).max(BigDecimal.ZERO)
                        .multiply(BigDecimal.valueOf(quantity)));
            }
            if (campaign.getUnitCost() != null) {
                costedRevenue = costedRevenue.add(kept);
                cost = cost.add(campaign.getUnitCost().multiply(BigDecimal.valueOf(quantity)));
            }
        }

        long closed() {
            return succeeded + failed + cancelled;
        }

        BigDecimal refunds() {
            return lostToFailed.add(lostToLeaves).add(priceDropRefunds).add(disputeRefunds);
        }

        BigDecimal profit() {
            return costedRevenue.subtract(cost);
        }

        BigDecimal averageGroupSize() {
            return average(successfulGroupMembers, succeeded);
        }

        String topFailureReason() {
            return failureCodes.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .map(e -> e.getKey().getLabel())
                    .orElse(null);
        }
    }

    private record Band(String code, String label, int minPercent) {
    }

    private static Band band(GroupBuyCampaign campaign) {
        BigDecimal discount = GroupBuyPricing.discountPercent(campaign.getBasePrice(), GroupBuyPricing.lowestPrice(campaign));
        Band match = BANDS.get(0);
        for (Band band : BANDS) {
            if (discount.compareTo(BigDecimal.valueOf(band.minPercent)) >= 0) {
                match = band;
            }
        }
        return match;
    }

    // ----- Number helpers ----------------------------------------------------------------------

    private static BigDecimal percent(long part, long whole) {
        return whole <= 0 ? BigDecimal.ZERO.setScale(1)
                : BigDecimal.valueOf(part * 100.0 / whole).setScale(1, RoundingMode.HALF_UP);
    }

    private static BigDecimal percent(BigDecimal part, BigDecimal whole) {
        return whole == null || whole.signum() <= 0 ? BigDecimal.ZERO.setScale(1)
                : orZero(part).multiply(BigDecimal.valueOf(100)).divide(whole, 1, RoundingMode.HALF_UP);
    }

    private static BigDecimal average(long total, long count) {
        return count <= 0 ? BigDecimal.ZERO.setScale(1)
                : BigDecimal.valueOf(total).divide(BigDecimal.valueOf(count), 1, RoundingMode.HALF_UP);
    }

    private static BigDecimal money(BigDecimal value) {
        return orZero(value).setScale(2, RoundingMode.HALF_UP);
    }
}
