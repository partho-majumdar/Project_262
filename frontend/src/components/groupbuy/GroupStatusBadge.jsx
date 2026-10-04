import React from 'react';
import { GROUP_STATUS_META } from './format';

export default function GroupStatusBadge({ status }) {
  const meta = GROUP_STATUS_META[status] || {
    label: status || 'Unknown',
    className: 'bg-slate-900 border-slate-700 text-slate-400',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
