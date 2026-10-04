import React from 'react';
import { Gavel } from 'lucide-react';
import { statusMeta, bidStatusMeta } from './proxyAuctionMeta';

/** A small status pill, used for both the auction lifecycle and an individual bid's outcome. */
export function AuctionStatusBadge({ status, kind = 'auction', className = '' }) {
  const meta = kind === 'bid' ? bidStatusMeta(status) : statusMeta(status);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[10px] font-bold rounded uppercase tracking-wide ${meta.tone} ${className}`}
    >
      <Gavel className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

export default AuctionStatusBadge;
