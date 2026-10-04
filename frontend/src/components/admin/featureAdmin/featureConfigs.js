import {
  adminWholesaleApi,
} from '../../../api/wholesaleApi';
import { adminAuctionApi as adminClassicAuctionApi } from '../../../api/auctionApi';
import { adminAuctionApi as adminCollectiveAuctionApi } from '../../../api/groupBuyingAuctionApi';
import { adminReverseGroupBuyingApi } from '../../../api/reverseGroupBuyingApi';
import { adminGroupReverseApi } from '../../../api/groupReverseApi';
import { listOf } from '../groupbuy/adminUi';

export const num = (value) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_META = {
  DRAFT: ['Draft', 'slate'],
  PENDING_APPROVAL: ['Pending approval', 'amber'],
  SCHEDULED: ['Scheduled', 'blue'],
  OPEN: ['Open', 'green'],
  LIVE: ['Live', 'green'],
  ACTIVE: ['Active', 'green'],
  PAUSED: ['Paused', 'amber'],
  ALMOST_COMPLETE: ['Almost complete', 'amber'],
  TARGET_REACHED: ['Target reached', 'blue'],
  READY_FOR_OFFERS: ['Ready for offers', 'blue'],
  OFFERS_RECEIVED: ['Offers received', 'blue'],
  OFFER_SELECTED: ['Offer selected', 'indigo'],
  ORDERS_CREATED: ['Orders created', 'indigo'],
  READY: ['Ready', 'blue'],
  FULFILLING: ['Fulfilling', 'indigo'],
  PROCESSING: ['Processing', 'blue'],
  FULFILLMENT: ['In fulfilment', 'indigo'],
  COMPLETED: ['Completed', 'green'],
  SUCCESS: ['Succeeded', 'green'],
  SOLD: ['Sold', 'green'],
  ENDED: ['Ended', 'slate'],
  CLOSED: ['Closed', 'slate'],
  FAILED: ['Failed', 'rose'],
  CANCELLED: ['Cancelled', 'slate'],
  RESERVE_NOT_MET: ['Reserve not met', 'rose'],
  EXPIRED: ['Expired', 'slate'],
  NO_OFFER: ['No offer received', 'rose'],
  TARGET_NOT_REACHED: ['Target not reached', 'rose'],
  REJECTED: ['Rejected', 'rose'],
  WITHDRAWN: ['Withdrawn', 'slate'],
};

export const statusMeta = (status) => STATUS_META[status] ?? [status ?? 'Unknown', 'slate'];

const countBy = (rows, key = 'status') => {
  const counts = new Map();
  for (const row of rows) {
    const name = row[key] || 'UNKNOWN';
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return counts;
};

const sum = (rows, pick) => rows.reduce((acc, row) => acc + num(pick(row)), 0);

/** Rows whose deadline has already passed but which are still in a live state. */
const overdue = (rows, pick) =>
  rows.filter((row) => {
    const at = pick(row);
    if (!at) return false;
    const status = row.status;
    if (['COMPLETED', 'SUCCESS', 'SOLD', 'ENDED', 'CANCELLED', 'FAILED', 'CLOSED', 'EXPIRED'].includes(status)) {
      return false;
    }
    return new Date(at).getTime() < Date.now();
  });

/** Live rows closing within 48 hours, soonest first. */
const closingSoon = (rows, pick) =>
  rows
    .filter((row) => {
      const at = pick(row);
      if (!at) return false;
      if (['COMPLETED', 'SUCCESS', 'SOLD', 'ENDED', 'CANCELLED', 'FAILED', 'CLOSED', 'EXPIRED'].includes(row.status)) {
        return false;
      }
      const diff = new Date(at).getTime() - Date.now();
      return diff > 0 && diff < 2 * DAY_MS;
    })
    .sort((a, b) => new Date(pick(a)).getTime() - new Date(pick(b)).getTime());

const LIVE = ['ACTIVE', 'OPEN', 'LIVE', 'PAUSED', 'SCHEDULED', 'ALMOST_COMPLETE', 'TARGET_REACHED',
  'READY_FOR_OFFERS', 'OFFERS_RECEIVED', 'OFFER_SELECTED', 'PROCESSING', 'FULFILLMENT', 'ORDERS_CREATED', 'READY'];

/** Statuses that mean "still running, an administrator may still have to act". */
export const LIVE_STATUSES = LIVE;

/** Statuses that are finished, so a missed deadline on them is not an exception. */
export const SETTLED_STATUSES = ['COMPLETED', 'SUCCESS', 'SOLD', 'ENDED', 'CANCELLED', 'FAILED', 'CLOSED', 'EXPIRED'];

/**
 * Every feature is described here once: how to load it, how to read its rows, and which order
 * type its delivery board lives under. The panels are written against this shape, so adding a sixth
 * feature means adding a config rather than a new tab implementation.
 */
export const FEATURE_CONFIGS = {
  wholesale: {
    id: 'wholesale',
    label: 'Wholesale',
    orderType: 'WHOLESALE',
    noun: 'offer',
    nounPlural: 'offers',
    source: 'Seller posts bulk terms; shoppers reserve into pools that fill to a minimum or a fixed lot.',
    load: () => adminWholesaleApi.getOffers().then(listOf),
    title: (row) => `${row.productName} — ${row.sellerStoreName}`,
    deadline: (row) => row.reservationDeadline,
    deadlineLabel: 'Reservation closes',
    progress: (row) => {
      const lots = num(row.activeLotCount) + num(row.completedLotCount) + num(row.failedLotCount);
      return { label: 'Lots', done: lots, total: lots, percent: lots ? 100 : 0 };
    },
    unitPrice: (row) => num(row.wholesaleUnitPrice),
    listPrice: (row) => num(row.productPrice),
    participation: (row) => num(row.activeLotCount) + num(row.completedLotCount),
    hasDisputes: true,
    disputeApi: adminWholesaleApi,
  },

  'reverse-group-buying': {
    id: 'reverse-group-buying',
    label: 'Reverse Group Buying',
    orderType: 'REVERSE_GROUP_BUYING',
    noun: 'offer',
    nounPlural: 'offers',
    source: 'A seller states a target quantity; shoppers collectively supply demand to unlock the price.',
    load: () => adminReverseGroupBuyingApi.getOffers().then(listOf),
    title: (row) => `${row.productName} — ${row.sellerStoreName}`,
    deadline: (row) => row.participationDeadline,
    deadlineLabel: 'Participation closes',
    progress: (row) => {
      const target = num(row.targetQuantity);
      const done = num(row.currentDemand);
      return {
        label: 'Units to target',
        done,
        total: target,
        percent: target ? Math.min(100, (done / target) * 100) : 0,
      };
    },
    unitPrice: (row) => num(row.unlockedUnitPrice),
    listPrice: (row) => num(row.productPrice),
    participation: (row) => num(row.participantCount),
    hasDisputes: false,
  },

  // Only group buy ships a feature-scoped audit logger today; see AUDIT_NOTE below.


  'customer-lead-group-buying': {
    id: 'customer-lead-group-buying',
    label: 'Customer Lead Group Buying',
    orderType: 'GROUP_REVERSE_BUYING',
    noun: 'demand',
    nounPlural: 'demands',
    source: 'A shopper creates the demand; sellers compete to fulfil it and the leader picks the winner.',
    load: () => adminGroupReverseApi.getDemands().then(listOf),
    title: (row) => `${row.productName} — led by ${row.leaderName ?? 'unknown'}`,
    deadline: (row) => row.joinDeadline,
    deadlineLabel: 'Join deadline',
    progress: (row) => {
      const total = num(row.requiredQuantity);
      const done = num(row.committedQuantity);
      return {
        label: 'Units committed',
        done,
        total,
        percent: total ? Math.min(100, (done / total) * 100) : 0,
      };
    },
    unitPrice: (row) => num(row.targetPrice),
    listPrice: (row) => num(row.productPrice),
    participation: (row) => num(row.memberCount),
    hasDisputes: false,
  },

  // Only group buy ships a feature-scoped audit logger today; see AUDIT_NOTE below.


  auctions: {
    id: 'auctions',
    label: 'Auctions',
    orderType: 'AUCTION',
    noun: 'auction',
    nounPlural: 'auctions',
    source: 'Proxy bidding: shoppers authorise a private maximum and the engine bids on their behalf.',
    load: () => adminClassicAuctionApi.getAll().then(listOf),
    title: (row) => `${row.productName} — ${row.sellerStoreName}`,
    deadline: (row) => row.endsAt,
    deadlineLabel: 'Bidding closes',
    progress: (row) => {
      const total = num(row.quantity);
      const done = num(row.unitsSold);
      return { label: 'Units sold', done, total, percent: total ? (done / total) * 100 : 0 };
    },
    unitPrice: (row) => num(row.currentPrice) || num(row.startingPrice),
    // An auction's price is expected to climb above the opening bid, so "priced above the listed
    // product" is not an anomaly here. Declaring no list price disables that signal for auctions
    // instead of letting it report every rising bid.
    listPrice: null,
    participation: (row) => num(row.bidderCount),
    hasDisputes: false,
  },

  // Only group buy ships a feature-scoped audit logger today; see AUDIT_NOTE below.


  'group-buying-auctions': {
    id: 'group-buying-auctions',
    label: 'Group Buying Auctions',
    orderType: 'GROUP_BUYING_AUCTION',
    noun: 'auction',
    nounPlural: 'auctions',
    source: 'Shoppers bid quantity and a maximum unit price; one clearing price is applied to everyone.',
    load: () => adminCollectiveAuctionApi.getAuctions().then(listOf),
    title: (row) => `${row.productName} — ${row.sellerStoreName}`,
    deadline: (row) => row.endsAt,
    deadlineLabel: 'Bidding closes',
    progress: (row) => {
      const total = num(row.minimumCollectiveQuantity);
      const done = num(row.collectiveQuantity);
      return {
        label: 'Units to minimum',
        done,
        total,
        percent: total ? Math.min(100, (done / total) * 100) : 0,
      };
    },
    unitPrice: (row) => num(row.finalUnitPrice) || num(row.projectedUnitPrice) || num(row.startingPrice),
    listPrice: (row) => num(row.productPrice),
    participation: (row) => num(row.participantCount),
    hasDisputes: false,
  },

  // Only group buy ships a feature-scoped audit logger today; see AUDIT_NOTE below.

};

/** Derives every number the overview and monitoring panels display from the real rows. */
export function deriveMetrics(config, rows) {
  const all = Array.isArray(rows) ? rows : [];
  const live = all.filter((row) => LIVE.includes(row.status));
  const past = all.filter((row) => !LIVE.includes(row.status));
  const closeAt = (row) => config.deadline(row);
  const byStatus = countBy(all);

  return {
    all,
    live,
    past,
    byStatus,
    total: all.length,
    liveCount: live.length,
    totalMoney: sum(live, config.unitPrice),
    totalParticipation: sum(all, config.participation),
    deadlines: closeAt,
    overdue: overdue(all, closeAt),
    closingSoon: closingSoon(all, closeAt),
    /** Live rows where nobody has engaged yet. */
    stalled: live.filter((row) => num(config.participation(row)) === 0),
    /** Live rows past 80% of their goal. */
    nearGoal: live.filter((row) => config.progress(row).percent >= 80),
  };
}
