import React from 'react';
import { RGB_STATUS_META, RGB_PARTICIPATION_META } from '../reverse/reverseMeta';

const base = 'px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap';

export function RgbStatusBadge({ status }) {
  const meta = RGB_STATUS_META[status] || { label: status || 'Unknown', className: 'bg-slate-900 border-slate-700 text-slate-400' };
  return <span className={`${base} ${meta.className}`}>{meta.label}</span>;
}

export function RgbParticipationBadge({ status }) {
  const meta =
    RGB_PARTICIPATION_META[status] || { label: status || 'Unknown', className: 'bg-slate-900 border-slate-700 text-slate-400' };
  return <span className={`${base} ${meta.className}`}>{meta.label}</span>;
}
