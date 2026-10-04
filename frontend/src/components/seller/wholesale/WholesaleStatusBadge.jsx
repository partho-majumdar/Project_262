import React from 'react';
import { OFFER_STATUS_META, POOL_STATUS_META } from './wholesaleMeta';

export function OfferStatusBadge({ status }) {
  return <StatusBadge status={status} metaMap={OFFER_STATUS_META} />;
}

export function PoolStatusBadge({ status }) {
  return <StatusBadge status={status} metaMap={POOL_STATUS_META} />;
}

function StatusBadge({ status, metaMap }) {
  const meta = metaMap[status] || { label: status || 'Unknown', className: 'bg-slate-900 border-slate-700 text-slate-400' };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
