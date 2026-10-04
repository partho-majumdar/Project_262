import React from 'react';
import { CAMPAIGN_STATUS_META } from './campaignMeta';

export default function CampaignStatusBadge({ status }) {
  const meta = CAMPAIGN_STATUS_META[status] || {
    label: status || 'Unknown',
    className: 'bg-slate-900 border-slate-700 text-slate-400',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
