export const AUCTION_STATUS_META = {
  DRAFT: { label: 'Draft', className: 'bg-slate-900 border-slate-700 text-slate-300' },
  SCHEDULED: { label: 'Scheduled', className: 'bg-amber-950/60 border-amber-700 text-amber-300' },
  OPEN: { label: 'Open for bids', className: 'bg-emerald-950/60 border-emerald-700 text-emerald-300' },
  COMPLETED: { label: 'Finalized', className: 'bg-indigo-950/60 border-indigo-700 text-indigo-300' },
  FAILED: { label: 'Minimum not met', className: 'bg-rose-950/60 border-rose-800 text-rose-300' },
  CANCELLED: { label: 'Cancelled', className: 'bg-slate-900 border-slate-700 text-slate-400' },
};

export const BID_STATUS_META = {
  BID_PLACED: { label: 'Bid open', className: 'bg-emerald-950/60 border-emerald-700 text-emerald-300' },
  WON: { label: 'Bid won', className: 'bg-indigo-950/60 border-indigo-700 text-indigo-300' },
  OUTBID: { label: 'Outbid', className: 'bg-amber-950/60 border-amber-700 text-amber-300' },
  CANCELLED: { label: 'Withdrawn', className: 'bg-slate-900 border-slate-700 text-slate-400' },
  REFUNDED: { label: 'Refunded', className: 'bg-rose-950/60 border-rose-800 text-rose-300' },
};

export const AUCTION_FILTERS = [
  { id: 'all', label: 'All', statuses: null },
  { id: 'drafts', label: 'Drafts', statuses: ['DRAFT'] },
  { id: 'scheduled', label: 'Scheduled', statuses: ['SCHEDULED'] },
  { id: 'open', label: 'Open for bids', statuses: ['OPEN'] },
  { id: 'settled', label: 'Finalized', statuses: ['COMPLETED', 'FAILED'] },
  { id: 'ended', label: 'Cancelled', statuses: ['CANCELLED'] },
];

const AUCTION_TERMINAL = ['COMPLETED', 'FAILED', 'CANCELLED'];

export const isAuctionTerminal = (status) => AUCTION_TERMINAL.includes(status);
export const canEditAuction = (status) => status === 'DRAFT' || status === 'SCHEDULED';
export const canPublishAuction = (status) => status === 'DRAFT';
export const canFinalizeAuction = (status) => status === 'OPEN';
export const canCancelAuction = (status) => !isAuctionTerminal(status);

/** An auction only takes bids while it is open and still has units left. */
export const auctionAcceptsBids = (auction) => auction?.status === 'OPEN' && (auction.remainingQuantity ?? 0) > 0;
