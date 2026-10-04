import React from 'react';
import { Check, Clock, Star, Store, X } from 'lucide-react';
import { groupReverseStatusMeta, timeUntilLabel } from '../../api/groupReverseApi';
import { formatDateTime, formatMoney } from '../groupbuy/format';

const TONE = {
  gray: 'bg-slate-800/70 border-slate-700 text-slate-300',
  blue: 'bg-sky-950/70 border-sky-800 text-sky-300',
  amber: 'bg-amber-950/70 border-amber-800 text-amber-300',
  purple: 'bg-purple-950/70 border-purple-800 text-purple-300',
  indigo: 'bg-indigo-950/70 border-indigo-800 text-indigo-300',
  green: 'bg-emerald-950/70 border-emerald-800 text-emerald-300',
  red: 'bg-rose-950/70 border-rose-800 text-rose-300',
};

export function GroupReverseStatusBadge({ status, className = '' }) {
  const meta = groupReverseStatusMeta(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${
        TONE[meta.tone] ?? TONE.gray
      } ${className}`}
    >
      {meta.label}
    </span>
  );
}

export function OfferStatusBadge({ status, className = '' }) {
  const map = {
    SUBMITTED: { label: 'Submitted', tone: 'blue' },
    ACCEPTED: { label: 'Accepted', tone: 'green' },
    CLOSED: { label: 'Closed', tone: 'gray' },
    WITHDRAWN: { label: 'Withdrawn', tone: 'gray' },
    EXPIRED: { label: 'Expired', tone: 'gray' },
  };
  const meta = map[status] ?? { label: status, tone: 'gray' };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${
        TONE[meta.tone]
      } ${className}`}
    >
      {meta.label}
    </span>
  );
}

/** A deadline, written as "closes in 2d 4h" and marked once it has gone. */
export function DeadlineLabel({ iso, prefix = 'Closes in', className = '' }) {
  const remaining = timeUntilLabel(iso);
  if (!remaining) return null;
  const closed = remaining === 'closed';
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${className}`}>
      <Clock className="w-3 h-3" />
      <span className={closed ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
        {closed ? 'Deadline passed' : `${prefix} ${remaining}`}
      </span>
    </span>
  );
}

/**
 * One seller's bid, as the leader sees it: the same columns for everybody, cheapest first, with
 * the effective unit price (freight spread over the group) doing the real comparing.
 */
export default function GroupReverseOfferCard({ offer, onSelect, selecting, disabled }) {
  const selectable = offer.selectable && !disabled && !selecting;

  return (
    <div
      className={`rounded-2xl border p-4 space-y-3 ${
        offer.accepted
          ? 'border-emerald-600 bg-emerald-950/30'
          : selectable
            ? 'border-slate-700 hover:border-indigo-600 bg-slate-900/60'
            : 'border-slate-800 bg-slate-900/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold text-white truncate">
            <Store className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            {offer.sellerStoreName}
          </p>
          {offer.sellerRating != null && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
              <Star className="w-3 h-3 text-amber-400" /> {offer.sellerRating}
            </p>
          )}
        </div>
        <OfferStatusBadge status={offer.status} />
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <dt className="text-slate-500">Unit price</dt>
          <dd className="text-white font-bold">{formatMoney(offer.unitPrice)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Delivery fee</dt>
          <dd className="text-white font-bold">{formatMoney(offer.deliveryFee)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Per unit incl. freight</dt>
          <dd className="text-emerald-300 font-bold">
            {formatMoney(offer.effectiveUnitPriceIncludingDelivery)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Group total</dt>
          <dd className="text-white font-bold">{formatMoney(offer.groupTotal)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Delivery</dt>
          <dd className="text-slate-300">{offer.estimatedDeliveryDays} day(s)</dd>
        </div>
        <div>
          <dt className="text-slate-500">Warranty</dt>
          <dd className="text-slate-300">{offer.warrantyMonths ?? 0} month(s)</dd>
        </div>
        <div>
          <dt className="text-slate-500">Covers</dt>
          <dd className="text-slate-300">{offer.offeredQuantity} unit(s)</dd>
        </div>
        <div>
          <dt className="text-slate-500">Valid until</dt>
          <dd className="text-slate-300">{formatDateTime(offer.offerExpiry)}</dd>
        </div>
      </dl>

      {offer.message && (
        <p className="text-xs text-slate-300 italic border-l-2 border-slate-700 pl-3">
          {offer.message}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        {offer.meetsTargetPrice ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <Check className="w-3.5 h-3.5" /> Meets the group's target price
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <X className="w-3.5 h-3.5" /> Above the group's target price
          </span>
        )}

        {offer.accepted ? (
          <span className="text-[11px] font-bold text-emerald-300">Selected by the group</span>
        ) : (
          <button
            type="button"
            disabled={!selectable}
            onClick={() => onSelect?.(offer)}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition"
          >
            {selecting ? 'Choosing…' : 'Choose this seller'}
          </button>
        )}
      </div>
    </div>
  );
}
