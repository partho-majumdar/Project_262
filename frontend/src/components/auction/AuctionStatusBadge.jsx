import React from 'react';
import { AUCTION_STATUS_META, BID_STATUS_META } from './auctionMeta';

const base = 'px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap';

export function AuctionStatusBadge({ status }) {
  const meta =
    AUCTION_STATUS_META[status] || { label: status || 'Unknown', className: 'bg-slate-900 border-slate-700 text-slate-400' };
  return <span className={`${base} ${meta.className}`}>{meta.label}</span>;
}

export function BidStatusBadge({ status }) {
  const meta = BID_STATUS_META[status] || { label: status || 'Unknown', className: 'bg-slate-900 border-slate-700 text-slate-400' };
  return <span className={`${base} ${meta.className}`}>{meta.label}</span>;
}
