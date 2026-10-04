package com.groupmart.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import com.groupmart.dto.groupbuy.admin.GroupBuyFraudFlagDto;
import com.groupmart.dto.groupbuy.admin.GroupBuyFraudFlagDto.FlagUser;
import com.groupmart.entity.*;
import com.groupmart.repository.AddressRepository;
import com.groupmart.repository.GroupBuyDisputeRepository;
import com.groupmart.repository.GroupBuyParticipantRepository;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Rule-based abuse detection over recent group buy participation. Flags are computed on demand, never stored;
 * each flag has a stable key so an administrator's dismissal can be remembered between runs.
 */
@Component
@RequiredArgsConstructor
public class GroupBuyFraudDetector {

    public static final String HIGH = "HIGH";
    public static final String MEDIUM = "MEDIUM";

    /** Leaving this many groups within the window looks like price or slot manipulation. */
    static final int JOIN_LEAVE_THRESHOLD = 3;
    static final int JOIN_LEAVE_HIGH = 5;
    /** Accounts sharing one shipping address inside a single group. */
    static final int SAME_GROUP_ADDRESS_THRESHOLD = 3;
    /** Accounts sharing one shipping address anywhere on the platform. */
    static final int SHARED_ADDRESS_THRESHOLD = 4;
    static final int SHARED_ADDRESS_HIGH = 6;
    /** An account is "new" if it joined a group within this many hours of being created. */
    static final long NEW_ACCOUNT_HOURS = 48;
    static final int NEW_ACCOUNT_GROUP_MIN_MEMBERS = 3;
    static final double NEW_ACCOUNT_GROUP_SHARE = 0.6;
    static final int INVITED_NEW_ACCOUNTS_THRESHOLD = 3;
    static final int DISPUTE_THRESHOLD = 3;

    private static final Map<String, String> RULE_LABELS = Map.of(
            "REPEATED_JOIN_LEAVE", "Repeated join and leave",
            "SHARED_ADDRESS_IN_GROUP", "Many accounts, one address, same group",
            "SHARED_ADDRESS", "Many accounts at one address",
            "SELLER_LINKED_BUYER", "Buyer linked to the seller",
            "NEW_ACCOUNT_GROUP", "Group filled by brand-new accounts",
            "INVITES_NEW_ACCOUNTS", "Invites bring in brand-new accounts",
            "FREQUENT_DISPUTES", "Frequent disputes");

    private final GroupBuyParticipantRepository participantRepository;
    private final GroupBuyDisputeRepository disputeRepository;
    private final AddressRepository addressRepository;

    public List<GroupBuyFraudFlagDto> detect(LocalDateTime since) {
        List<GroupBuyParticipant> rows = participantRepository.findActivitySince(since);
        List<GroupBuyFraudFlagDto> flags = new ArrayList<>();
        repeatedJoinLeave(rows, since, flags);
        sharedAddressInGroup(rows, flags);
        sharedAddress(rows, flags);
        sellerLinkedBuyers(rows, flags);
        newAccountGroups(rows, flags);
        invitesOfNewAccounts(rows, flags);
        frequentDisputes(since, flags);

        // One buyer can match a rule through several rows (for example several groups); keep one flag per key
        Map<String, GroupBuyFraudFlagDto> unique = new LinkedHashMap<>();
        flags.forEach(flag -> unique.merge(flag.getKey(), flag, (first, next) -> {
            first.setEvidenceCount(first.getEvidenceCount() + next.getEvidenceCount());
            if (next.getLastSeenAt() != null
                    && (first.getLastSeenAt() == null || next.getLastSeenAt().isAfter(first.getLastSeenAt()))) {
                first.setLastSeenAt(next.getLastSeenAt());
            }
            return first;
        }));
        flags = new ArrayList<>(unique.values());
        flags.sort(Comparator
                .comparing((GroupBuyFraudFlagDto f) -> HIGH.equals(f.getSeverity()) ? 0 : 1)
                .thenComparing(GroupBuyFraudFlagDto::getLastSeenAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return flags;
    }

    // ----- Rules ---------------------------------------------------------------------------------

    private void repeatedJoinLeave(List<GroupBuyParticipant> rows, LocalDateTime since, List<GroupBuyFraudFlagDto> out) {
        Map<User, List<GroupBuyParticipant>> leftByUser = rows.stream()
                .filter(p -> p.getStatus() == GroupBuyParticipantStatus.LEFT)
                .filter(p -> p.getLeftAt() != null && !p.getLeftAt().isBefore(since))
                .collect(Collectors.groupingBy(GroupBuyParticipant::getUser, LinkedHashMap::new, Collectors.toList()));

        leftByUser.forEach((user, left) -> {
            if (left.size() < JOIN_LEAVE_THRESHOLD) {
                return;
            }
            long campaigns = left.stream().map(p -> p.getBuyGroup().getCampaign().getId()).distinct().count();
            out.add(flag("REPEATED_JOIN_LEAVE", "JOIN_LEAVE:" + user.getId(),
                    left.size() >= JOIN_LEAVE_HIGH ? HIGH : MEDIUM,
                    GroupBuyAdminMapper.fullName(user) + " left " + left.size() + " groups",
                    "Joined and then left " + left.size() + " groups across " + campaigns
                            + " campaign(s). Repeated leaving can hold spots, reset price tiers or farm refunds.",
                    List.of(user), singleCampaign(left), null, left.size(),
                    latest(left.stream().map(GroupBuyParticipant::getLeftAt))));
        });
    }

    private void sharedAddressInGroup(List<GroupBuyParticipant> rows, List<GroupBuyFraudFlagDto> out) {
        Map<String, List<GroupBuyParticipant>> byGroupAndAddress = rows.stream()
                .collect(Collectors.groupingBy(p -> p.getBuyGroup().getId() + "|" + addressKey(p)));

        byGroupAndAddress.forEach((key, members) -> {
            List<User> users = distinctUsers(members);
            if (users.size() < SAME_GROUP_ADDRESS_THRESHOLD) {
                return;
            }
            GroupBuyGroup group = members.get(0).getBuyGroup();
            out.add(flag("SHARED_ADDRESS_IN_GROUP", "GROUP_ADDRESS:" + group.getId() + ":" + hash(addressKey(members.get(0))),
                    HIGH,
                    users.size() + " accounts ship to one address in group " + group.getInviteCode(),
                    users.size() + " different accounts in the same group use the shipping address \""
                            + GroupBuyAdminMapper.shippingAddress(members.get(0))
                            + "\". One person may be using extra accounts to reach the minimum group size.",
                    users, group.getCampaign(), group, users.size(),
                    latest(members.stream().map(GroupBuyParticipant::getJoinedAt))));
        });
    }

    private void sharedAddress(List<GroupBuyParticipant> rows, List<GroupBuyFraudFlagDto> out) {
        Map<String, List<GroupBuyParticipant>> byAddress = rows.stream()
                .collect(Collectors.groupingBy(GroupBuyFraudDetector::addressKey));

        byAddress.forEach((address, members) -> {
            List<User> users = distinctUsers(members);
            if (users.size() < SHARED_ADDRESS_THRESHOLD) {
                return;
            }
            long groups = members.stream().map(p -> p.getBuyGroup().getId()).distinct().count();
            if (groups == 1 && users.size() >= SAME_GROUP_ADDRESS_THRESHOLD) {
                return; // already reported by the same-group rule
            }
            out.add(flag("SHARED_ADDRESS", "ADDRESS:" + hash(address),
                    users.size() >= SHARED_ADDRESS_HIGH ? HIGH : MEDIUM,
                    users.size() + " accounts share one shipping address",
                    users.size() + " accounts used \"" + GroupBuyAdminMapper.shippingAddress(members.get(0))
                            + "\" across " + groups + " group(s). Check whether they belong to one household or one person.",
                    users, singleCampaign(members), null, users.size(),
                    latest(members.stream().map(GroupBuyParticipant::getJoinedAt))));
        });
    }

    private void sellerLinkedBuyers(List<GroupBuyParticipant> rows, List<GroupBuyFraudFlagDto> out) {
        Map<UUID, Set<String>> sellerAddresses = new HashMap<>();
        for (GroupBuyParticipant participant : rows) {
            GroupBuyCampaign campaign = participant.getBuyGroup().getCampaign();
            User seller = campaign.getSellerStore().getUser();
            Set<String> addresses = sellerAddresses.computeIfAbsent(seller.getId(), id ->
                    addressRepository.findByUserIdOrderByIsDefaultDescCreatedAtDesc(id).stream()
                            .map(GroupBuyFraudDetector::addressKey)
                            .collect(Collectors.toSet()));
            if (!addresses.contains(addressKey(participant))) {
                continue;
            }
            User buyer = participant.getUser();
            out.add(flag("SELLER_LINKED_BUYER", "SELLER_LINK:" + campaign.getId() + ":" + buyer.getId(), HIGH,
                    GroupBuyAdminMapper.fullName(buyer) + " ships to the seller's address",
                    "This buyer joined a group for " + campaign.getSellerStore().getStoreName()
                            + " using an address saved on the seller's own account. The seller may be buying from"
                            + " themselves to make groups succeed.",
                    List.of(buyer, seller), campaign, participant.getBuyGroup(), 1, participant.getJoinedAt()));
        }
    }

    private void newAccountGroups(List<GroupBuyParticipant> rows, List<GroupBuyFraudFlagDto> out) {
        Map<GroupBuyGroup, List<GroupBuyParticipant>> byGroup = rows.stream()
                .filter(p -> p.getStatus() != GroupBuyParticipantStatus.LEFT)
                .collect(Collectors.groupingBy(GroupBuyParticipant::getBuyGroup));

        byGroup.forEach((group, members) -> {
            if (members.size() < NEW_ACCOUNT_GROUP_MIN_MEMBERS) {
                return;
            }
            List<GroupBuyParticipant> fresh = members.stream().filter(GroupBuyFraudDetector::isNewAccount).toList();
            if (fresh.size() < NEW_ACCOUNT_GROUP_MIN_MEMBERS || fresh.size() < members.size() * NEW_ACCOUNT_GROUP_SHARE) {
                return;
            }
            boolean all = fresh.size() == members.size();
            out.add(flag("NEW_ACCOUNT_GROUP", "NEW_ACCOUNTS:" + group.getId(), all ? HIGH : MEDIUM,
                    fresh.size() + " of " + members.size() + " members in group " + group.getInviteCode() + " are new accounts",
                    fresh.size() + " members joined within " + NEW_ACCOUNT_HOURS
                            + " hours of creating their account. Throwaway accounts are a common way to fake group demand.",
                    distinctUsers(fresh), group.getCampaign(), group, fresh.size(),
                    latest(fresh.stream().map(GroupBuyParticipant::getJoinedAt))));
        });
    }

    private void invitesOfNewAccounts(List<GroupBuyParticipant> rows, List<GroupBuyFraudFlagDto> out) {
        Map<User, List<GroupBuyParticipant>> byInviter = rows.stream()
                .filter(p -> p.getInvitedBy() != null)
                .filter(GroupBuyFraudDetector::isNewAccount)
                .collect(Collectors.groupingBy(GroupBuyParticipant::getInvitedBy));

        byInviter.forEach((inviter, invitees) -> {
            List<User> users = distinctUsers(invitees);
            if (users.size() < INVITED_NEW_ACCOUNTS_THRESHOLD) {
                return;
            }
            List<User> involved = new ArrayList<>();
            involved.add(inviter);
            involved.addAll(users);
            out.add(flag("INVITES_NEW_ACCOUNTS", "INVITE_NEW:" + inviter.getId(), MEDIUM,
                    GroupBuyAdminMapper.fullName(inviter) + " invited " + users.size() + " brand-new accounts",
                    "Every one of these invitees created their account less than " + NEW_ACCOUNT_HOURS
                            + " hours before joining. The inviter may be creating accounts to fill their own groups.",
                    involved, singleCampaign(invitees), null, users.size(),
                    latest(invitees.stream().map(GroupBuyParticipant::getJoinedAt))));
        });
    }

    private void frequentDisputes(LocalDateTime since, List<GroupBuyFraudFlagDto> out) {
        Map<User, List<GroupBuyDispute>> byUser = disputeRepository.findByCreatedAtGreaterThanEqual(since).stream()
                .collect(Collectors.groupingBy(GroupBuyDispute::getRaisedBy));

        byUser.forEach((user, disputes) -> {
            if (disputes.size() < DISPUTE_THRESHOLD) {
                return;
            }
            long refunded = disputes.stream().filter(d -> d.getRefundAmount() != null && d.getRefundAmount().signum() > 0).count();
            out.add(flag("FREQUENT_DISPUTES", "DISPUTES:" + user.getId(), MEDIUM,
                    GroupBuyAdminMapper.fullName(user) + " opened " + disputes.size() + " disputes",
                    disputes.size() + " disputes in this period, " + refunded
                            + " of them refunded. Check for refund abuse before approving more refunds.",
                    List.of(user), null, null, disputes.size(),
                    latest(disputes.stream().map(GroupBuyDispute::getCreatedAt))));
        });
    }

    // ----- Helpers -------------------------------------------------------------------------------

    private static GroupBuyFraudFlagDto flag(String rule, String key, String severity, String title, String description,
                                             List<User> users, GroupBuyCampaign campaign, GroupBuyGroup group,
                                             int evidence, LocalDateTime lastSeen) {
        return GroupBuyFraudFlagDto.builder()
                .key(key)
                .rule(rule)
                .ruleLabel(RULE_LABELS.get(rule))
                .severity(severity)
                .title(title)
                .description(description)
                .users(users.stream().map(u -> FlagUser.builder()
                        .id(u.getId())
                        .name(GroupBuyAdminMapper.fullName(u))
                        .email(u.getEmail())
                        .enabled(u.isEnabled())
                        .build()).toList())
                .campaignId(campaign != null ? campaign.getId() : null)
                .campaignTitle(campaign != null ? campaign.getTitle() : null)
                .groupId(group != null ? group.getId() : null)
                .inviteCode(group != null ? group.getInviteCode() : null)
                .evidenceCount(evidence)
                .lastSeenAt(lastSeen)
                .build();
    }

    private static boolean isNewAccount(GroupBuyParticipant participant) {
        LocalDateTime created = participant.getUser().getCreatedAt();
        return created != null && participant.getJoinedAt() != null
                && Duration.between(created, participant.getJoinedAt()).toHours() < NEW_ACCOUNT_HOURS;
    }

    private static List<User> distinctUsers(Collection<GroupBuyParticipant> participants) {
        Map<UUID, User> users = new LinkedHashMap<>();
        participants.forEach(p -> users.putIfAbsent(p.getUser().getId(), p.getUser()));
        return new ArrayList<>(users.values());
    }

    /** The campaign when every row belongs to the same one, otherwise null. */
    private static GroupBuyCampaign singleCampaign(Collection<GroupBuyParticipant> participants) {
        Set<GroupBuyCampaign> campaigns = participants.stream()
                .map(p -> p.getBuyGroup().getCampaign())
                .collect(Collectors.toSet());
        return campaigns.size() == 1 ? campaigns.iterator().next() : null;
    }

    private static LocalDateTime latest(java.util.stream.Stream<LocalDateTime> times) {
        return times.filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null);
    }

    /** Street, unit, postal code and country with case, spacing and punctuation removed. */
    static String addressKey(GroupBuyParticipant p) {
        return normalize(p.getShippingAddressLine1(), p.getShippingAddressLine2(), p.getShippingPostalCode(),
                p.getShippingCountry());
    }

    static String addressKey(Address a) {
        return normalize(a.getStreetAddress(), a.getApartment(), a.getPostalCode(), a.getCountry());
    }

    private static String normalize(String... parts) {
        return Arrays.stream(parts)
                .map(part -> part == null ? "" : part.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", ""))
                .collect(Collectors.joining("|"));
    }

    private static String hash(String value) {
        return UUID.nameUUIDFromBytes(value.getBytes(StandardCharsets.UTF_8)).toString();
    }
}
