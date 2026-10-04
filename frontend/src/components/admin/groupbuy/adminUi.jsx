import React, { useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, X } from 'lucide-react';

export const listOf = (value) => (Array.isArray(value) ? value : []);

export function Banner({ error, notice, onClear }) {
  if (!error && !notice) return null;
  const tone = error
    ? 'bg-rose-950/50 border-rose-800 text-rose-200'
    : 'bg-emerald-950/50 border-emerald-800 text-emerald-200';
  return (
    <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 ${tone}`}>
      <span className="flex items-center gap-2">
        {!error && <CheckCircle2 className="w-4 h-4 shrink-0" />} {error || notice}
      </span>
      <button type="button" onClick={onClear} aria-label="Dismiss">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="py-12 text-center text-slate-400 text-xs">
      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-rose-500 mb-3" /> {label}
    </div>
  );
}

export function EmptyState({ children }) {
  return (
    <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl">
      {children}
    </div>
  );
}

export function Panel({ title, icon: Icon, actions, children, className = '' }) {
  return (
    <section className={`glass-panel p-5 rounded-3xl border border-slate-800 space-y-4 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {title && (
            <h3 className="text-xs font-black uppercase tracking-wider text-rose-300 flex items-center gap-2">
              {Icon && <Icon className="w-4 h-4" />} {title}
            </h3>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function FilterChips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition ${
            value === option.id
              ? 'bg-rose-600 border-rose-500 text-white'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          {option.label}
          {option.count != null && <span className="ml-1.5 opacity-75">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

const PILL_TONES = {
  red: 'bg-rose-950/60 border-rose-800 text-rose-300',
  amber: 'bg-amber-950/60 border-amber-700 text-amber-300',
  green: 'bg-emerald-950/60 border-emerald-700 text-emerald-300',
  blue: 'bg-cyan-950/60 border-cyan-800 text-cyan-300',
  indigo: 'bg-indigo-950/60 border-indigo-700 text-indigo-300',
  slate: 'bg-slate-900 border-slate-700 text-slate-400',
};

export function Pill({ tone = 'slate', children }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
        PILL_TONES[tone] || PILL_TONES.slate
      }`}
    >
      {children}
    </span>
  );
}

export const DISPUTE_STATUS_META = {
  OPEN: { label: 'New', tone: 'amber' },
  UNDER_REVIEW: { label: 'In review', tone: 'blue' },
  RESOLVED: { label: 'Resolved', tone: 'green' },
  REJECTED: { label: 'Rejected', tone: 'slate' },
};

export const PARTICIPANT_STATUS_META = {
  JOINED: { label: 'Active', tone: 'blue' },
  CONVERTED: { label: 'Ordered', tone: 'green' },
  REFUNDED: { label: 'Refunded', tone: 'amber' },
  LEFT: { label: 'Left', tone: 'slate' },
};

export function StatusPill({ meta, status }) {
  const entry = meta[status] || { label: status, tone: 'slate' };
  return <Pill tone={entry.tone}>{entry.label}</Pill>;
}

/**
 * Inline confirmation with an optional or required reason. Money-moving actions always go through this,
 * so an administrator sees the consequence before anything happens.
 */
export function ConfirmAction({
  title,
  description,
  confirmLabel,
  reasonLabel = 'Reason',
  reasonRequired = false,
  reasonPlaceholder = '',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const [reason, setReason] = useState('');
  const blocked = busy || (reasonRequired && !reason.trim());
  const button =
    tone === 'danger' ? 'bg-rose-600 hover:bg-rose-500' : tone === 'warn' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500';
  return (
    <div className="p-4 rounded-2xl border border-slate-700 bg-slate-950/80 space-y-3 text-xs">
      <div className="space-y-1">
        <p className="font-bold text-white">{title}</p>
        {description && <p className="text-slate-400">{description}</p>}
      </div>
      <label className="block space-y-1">
        <span className="text-[11px] text-slate-400 font-semibold">
          {reasonLabel} {reasonRequired ? <span className="text-rose-400">(required)</span> : '(optional)'}
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder={reasonPlaceholder}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 font-bold"
        >
          Back
        </button>
        <button
          type="button"
          disabled={blocked}
          onClick={() => onConfirm(reason.trim())}
          className={`px-3 py-1.5 rounded-xl text-white font-bold flex items-center gap-1.5 disabled:opacity-50 ${button}`}
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {confirmLabel}
        </button>
      </div>
    </div>
  );
}

/** Horizontal bar for simple in-table comparisons. */
export function Bar({ value, max, tone = 'bg-rose-500' }) {
  const width = max > 0 ? Math.max(2, Math.round((Number(value) / Number(max)) * 100)) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
    </div>
  );
}

// Shared with the seller and customer analytics views
export { downloadCsv } from '../../groupbuy/csv';

export const tableClass = 'w-full text-left text-xs text-slate-300';
export const theadClass = 'text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800';
export const rowClass = 'border-b border-slate-900 hover:bg-slate-900/40 align-top';
