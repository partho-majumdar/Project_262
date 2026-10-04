import { formatMoney } from '../groupbuy/format';

/**
 * Display metadata for the sealed-bid proxy auction.
 *
 * Kept apart from `components/auction/auctionMeta.js`, which belongs to the collective
 * group-buying auction and has its own status vocabulary.
 */

export const AUCTION_STATUS_META = {
  DRAFT: { label: 'Draft', tone: 'bg-slate-800 text-slate-300 border-slate-700' },
  SCHEDULED: { label: 'Scheduled', tone: 'bg-sky-950 text-sky-300 border-sky-800' },
  LIVE: { label: 'Live', tone: 'bg-emerald-950 text-emerald-300 border-emerald-800' },
  ENDED: { label: 'Ended - no sale', tone: 'bg-slate-800 text-slate-300 border-slate-700' },
  SOLD: { label: 'Sold', tone: 'bg-amber-950 text-amber-300 border-amber-800' },
  RESERVE_NOT_MET: { label: 'Reserve not met', tone: 'bg-rose-950 text-rose-300 border-rose-800' },
  CANCELLED: { label: 'Cancelled', tone: 'bg-rose-950 text-rose-300 border-rose-800' },
};

export const AUCTION_BID_STATUS_META = {
  ACTIVE: { label: 'Active', tone: 'bg-sky-950 text-sky-300 border-sky-800' },
  WINNING: { label: 'Leading', tone: 'bg-emerald-950 text-emerald-300 border-emerald-800' },
  OUTBID: { label: 'Outbid', tone: 'bg-amber-950 text-amber-300 border-amber-800' },
  WON: { label: 'Won', tone: 'bg-amber-950 text-amber-300 border-amber-800' },
  LOST: { label: 'Lost', tone: 'bg-slate-800 text-slate-400 border-slate-700' },
  CANCELLED: { label: 'Withdrawn', tone: 'bg-slate-800 text-slate-400 border-slate-700' },
};

export const statusMeta = (status) =>
  AUCTION_STATUS_META[status] || { label: status || 'Unknown', tone: 'bg-slate-800 text-slate-300 border-slate-700' };

export const bidStatusMeta = (status) =>
  AUCTION_BID_STATUS_META[status] || { label: status || 'Unknown', tone: 'bg-slate-800 text-slate-300 border-slate-700' };

/**
 * The public outcome wording. Only the winner's own view ever says the reserve was met - everybody
 * else learns nothing beyond "reserve not met", so the figure itself stays secret.
 */
export const reserveLine = (auction) => {
  if (!auction?.hasReserve) return null;
  if (auction.reserveMet) return { text: 'Reserve met', tone: 'text-emerald-400' };
  return { text: 'Reserve not met yet', tone: 'text-slate-400' };
};

/** Groups an auction for the marketplace filter chips. */
export const auctionBucket = (auction) => {
  if (auction?.status === 'LIVE') return 'live';
  if (auction?.status === 'SCHEDULED') return 'scheduled';
  if (auction?.status === 'DRAFT') return 'draft';
  return 'closed';
};

export const BUCKET_LABEL = {
  live: 'Live now',
  scheduled: 'Starting soon',
  closed: 'Closed',
};

/**
 * Counts down against the server's clock, not the browser's.
 *
 * `serverTime` comes from the backend on every poll and `timeRemainingSeconds` is what the server
 * itself computed, so a skewed or tampered client clock cannot make a deadline look further away
 * than it is.
 */
export function secondsRemaining(auction) {
  if (!auction) return 0;
  if (Number.isFinite(auction.timeRemainingSeconds)) return Math.max(0, auction.timeRemainingSeconds);
  if (!auction.endsAt || !auction.serverTime) return 0;
  const skewMs = new Date(auction.serverTime).getTime() - Date.now();
  return Math.max(0, Math.floor((new Date(auction.endsAt).getTime() - (Date.now() + skewMs)) / 1000));
}

export { formatMoney };
