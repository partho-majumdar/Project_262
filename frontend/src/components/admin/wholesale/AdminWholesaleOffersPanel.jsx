import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, Slash, XCircle } from 'lucide-react';
import { adminWholesaleApi } from '../../../api/wholesaleApi';
import { apiErrorMessage } from '../../../api/groupBuyApi';
import { formatDateTime, formatMoney } from '../../groupbuy/format';
import { OfferStatusBadge } from '../../seller/wholesale/WholesaleStatusBadge';
import { Banner, ConfirmAction, EmptyState, FilterChips, Loading, listOf } from '../groupbuy/adminUi';

const FILTERS = [
  { id: 'LIVE', label: 'Live & paused', statuses: ['ACTIVE', 'PAUSED'] },
  { id: 'DRAFTS', label: 'Drafts', statuses: ['DRAFT'] },
  { id: 'HISTORY', label: 'History', statuses: ['CLOSED', 'CANCELLED'] },
  { id: 'ALL', label: 'All', statuses: null },
];

/**
 * Read-only oversight plus emergency moderation. Sellers create, activate, pause and cancel their
 * own wholesale offers directly - there is no approval step here.
 */
export default function AdminWholesaleOffersPanel({ onChanged }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('LIVE');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOffers(listOf(await adminWholesaleApi.getOffers()));
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load wholesale offers'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((f) => [f.id, f.statuses ? offers.filter((o) => f.statuses.includes(o.status)).length : offers.length])
      ),
    [offers]
  );

  const visible = useMemo(() => {
    const statuses = FILTERS.find((f) => f.id === filter)?.statuses;
    return statuses ? offers.filter((o) => statuses.includes(o.status)) : offers;
  }, [offers, filter]);

  const handleChanged = (updated, message) => {
    setOffers((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setNotice(message);
    setError('');
    onChanged?.();
  };

  if (loading && offers.length === 0) return <Loading label="Loading wholesale offers…" />;

  return (
    <div className="space-y-4 text-xs">
      <FilterChips options={FILTERS.map((f) => ({ ...f, count: counts[f.id] }))} value={filter} onChange={setFilter} />
      <Banner error={error} notice={notice} onClear={() => { setError(''); setNotice(''); }} />

      {visible.length === 0 ? (
        <EmptyState>No offers in this filter.</EmptyState>
      ) : (
        <div className="space-y-3">
          {visible.map((offer) => (
            <OfferRow key={offer.id} offer={offer} onChanged={handleChanged} onError={setError} />
          ))}
        </div>
      )}
    </div>
  );
}

function OfferRow({ offer: o, onChanged, onError }) {
  const [mode, setMode] = useState(null); // 'force-close' | 'cancel'
  const [busy, setBusy] = useState(false);

  const act = async (fn, message) => {
    setBusy(true);
    try {
      onChanged(await fn(), message);
      setMode(null);
    } catch (err) {
      onError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const moderatable = !['CLOSED', 'CANCELLED', 'DRAFT'].includes(o.status);

  return (
    <article className="glass-panel p-4 rounded-3xl border border-slate-800 space-y-3">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-20 h-20 rounded-2xl bg-slate-800 overflow-hidden border border-slate-700 shrink-0 flex items-center justify-center">
          {o.productImageUrl ? <img src={o.productImageUrl} alt="" className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-slate-500" />}
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-black text-white">{o.productName}</span>
            <OfferStatusBadge status={o.status} />
          </div>
          <p className="text-slate-400">
            {o.sellerStoreName} · {formatMoney(o.productPrice)} → <strong className="text-emerald-300">{formatMoney(o.wholesaleUnitPrice)}</strong> wholesale
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          ['Minimum qty', o.wholesaleMinimumQuantity],
          ['Max available', o.maxAvailableQuantity],
          ['Per customer', `${o.minQuantityPerCustomer}–${o.maxQuantityPerCustomer}`],
          ['Deadline', formatDateTime(o.reservationDeadline)],
          ['Active lots', o.activeLotCount],
          ['Completed lots', o.completedLotCount],
        ].map(([label, value]) => (
          <div key={label} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] text-slate-500 block">{label}</span>
            <span className="font-mono font-bold text-white">{value}</span>
          </div>
        ))}
      </div>

      {mode === 'force-close' && (
        <ConfirmAction
          title={`Close '${o.productName}' now?`}
          description="Open lots stay untouched, but no new lots or reservations may start. Use Cancel instead to refund active reservations."
          confirmLabel="Close offer"
          tone="warn"
          busy={busy}
          onCancel={() => setMode(null)}
          onConfirm={(reason) => act(() => adminWholesaleApi.forceCloseOffer(o.id, reason), `Closed '${o.productName}'.`)}
        />
      )}
      {mode === 'cancel' && (
        <ConfirmAction
          title={`Cancel '${o.productName}' and refund everyone?`}
          description="This cannot be undone."
          confirmLabel="Cancel offer"
          busy={busy}
          onCancel={() => setMode(null)}
          onConfirm={(reason) => act(() => adminWholesaleApi.cancelOffer(o.id, reason), `Cancelled '${o.productName}'.`)}
        />
      )}

      {mode === null && moderatable && (
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setMode('force-close')} className="px-3.5 py-2 rounded-xl border border-amber-800 text-amber-300 hover:bg-amber-950 font-bold flex items-center gap-1.5">
            <Slash className="w-3.5 h-3.5" /> Force close
          </button>
          <button type="button" onClick={() => setMode('cancel')} className="px-3.5 py-2 rounded-xl border border-rose-800 text-rose-300 hover:bg-rose-950 font-bold flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" /> Cancel
          </button>
        </div>
      )}
    </article>
  );
}
