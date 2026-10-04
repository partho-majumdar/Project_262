import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Package, Plus, RefreshCw, X } from 'lucide-react';
import axiosClient from '../../../api/axiosClient';
import { sellerWholesaleApi } from '../../../api/wholesaleApi';
import { apiErrorMessage } from '../../../api/groupBuyApi';
import { formatDateTime, formatMoney } from '../../groupbuy/format';
import WholesaleOfferForm from './WholesaleOfferForm';
import WholesaleOfferDetail from './WholesaleOfferDetail';
import { OfferStatusBadge } from './WholesaleStatusBadge';
import { OFFER_FILTERS } from './wholesaleMeta';

const listOf = (res) => (Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []);

const ACTION_MESSAGES = {
  activate: 'Offer is now live.',
  pause: 'Offer paused. Customers cannot reserve quantity until you resume it.',
  resume: 'Offer resumed.',
  cancel: 'Offer cancelled. Active reservations were refunded and unsold stock was released.',
};

export default function SellerWholesaleTab() {
  const [offers, setOffers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // view: { mode: 'list' } | { mode: 'form', offer? } | { mode: 'detail', id }
  const [view, setView] = useState({ mode: 'list' });
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const [offerRes, productRes] = await Promise.allSettled([
      sellerWholesaleApi.getOffers(),
      axiosClient.get('/seller/products'),
    ]);
    if (offerRes.status === 'fulfilled') setOffers(listOf(offerRes.value));
    else setError(apiErrorMessage(offerRes.reason, 'Could not load wholesale offers'));
    if (productRes.status === 'fulfilled') setProducts(listOf(productRes.value));
    setRefreshKey((k) => k + 1);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (message) => {
    setError('');
    setNotice(message);
  };

  const handleSave = async (payload, activateNow) => {
    setBusy(true);
    setFormError('');
    const existing = view.offer;
    let saved;
    try {
      saved = existing
        ? await sellerWholesaleApi.updateOffer(existing.id, payload)
        : await sellerWholesaleApi.createOffer(payload);
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not save the offer'));
      setBusy(false);
      return;
    }
    try {
      if (activateNow) await sellerWholesaleApi.activateOffer(saved.id);
      flash(activateNow ? 'Saved and activated. Lot #1 is now open.' : 'Saved as draft.');
    } catch (err) {
      setNotice('');
      setError(`Saved as draft, but activation failed: ${apiErrorMessage(err)}`);
    }
    await load({ silent: true });
    setView({ mode: 'detail', id: saved.id });
    setBusy(false);
  };

  const handleAction = async (action, offer, reason) => {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      if (action === 'activate') await sellerWholesaleApi.activateOffer(offer.id);
      if (action === 'pause') await sellerWholesaleApi.pauseOffer(offer.id);
      if (action === 'resume') await sellerWholesaleApi.resumeOffer(offer.id);
      if (action === 'cancel') await sellerWholesaleApi.cancelOffer(offer.id, reason);
      flash(ACTION_MESSAGES[action]);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
    await load({ silent: true });
    setBusy(false);
  };

  const stats = useMemo(() => {
    const count = (statuses) => offers.filter((o) => statuses.includes(o.status)).length;
    return {
      live: count(['ACTIVE']),
      needsWork: count(['DRAFT']),
      activeLots: offers.reduce((s, o) => s + (o.activeLotCount || 0), 0),
      completedLots: offers.reduce((s, o) => s + (o.completedLotCount || 0), 0),
    };
  }, [offers]);

  const visibleOffers = useMemo(() => {
    const statuses = OFFER_FILTERS.find((f) => f.id === filter)?.statuses;
    return statuses ? offers.filter((o) => statuses.includes(o.status)) : offers;
  }, [offers, filter]);

  const banner = (
    <>
      {error && (
        <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-800 text-rose-200 text-xs flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-950/50 border border-emerald-800 text-emerald-200 text-xs flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {notice}
          </span>
          <button onClick={() => setNotice('')} aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400 text-xs">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-3" /> Loading wholesale offers…
      </div>
    );
  }

  if (view.mode === 'form') {
    return (
      <div className="space-y-4">
        {banner}
        <WholesaleOfferForm
          key={view.offer?.id || 'new'}
          offer={view.offer}
          products={products}
          saving={busy}
          serverError={formError}
          onSave={handleSave}
          onCancel={() => {
            setFormError('');
            setView(view.offer ? { mode: 'detail', id: view.offer.id } : { mode: 'list' });
          }}
        />
      </div>
    );
  }

  const detailOffer = view.mode === 'detail' ? offers.find((o) => o.id === view.id) : null;
  if (detailOffer) {
    return (
      <div className="space-y-4">
        {banner}
        <WholesaleOfferDetail
          offer={detailOffer}
          busy={busy}
          refreshKey={refreshKey}
      onRefresh={load}
          onBack={() => setView({ mode: 'list' })}
          onEdit={(offer) => {
            setFormError('');
            setView({ mode: 'form', offer });
          }}
          onAction={handleAction}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {banner}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-black text-white">Collaborative Wholesale Purchasing</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load({ silent: true })}
            className="px-3 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={() => {
              setFormError('');
              setView({ mode: 'form' });
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" /> New wholesale offer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Live" value={stats.live} tone="good" />
        <StatTile label="Drafts" value={stats.needsWork} />
        <StatTile label="Open lots" value={stats.activeLots} />
        <StatTile label="Completed lots" value={stats.completedLots} tone="good" />
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        {OFFER_FILTERS.map((f) => {
          const n = f.statuses ? offers.filter((o) => f.statuses.includes(o.status)).length : offers.length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full border font-bold transition ${
                filter === f.id
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {f.label} ({n})
            </button>
          );
        })}
      </div>

      {visibleOffers.length === 0 ? (
        <div className="glass-panel p-10 rounded-3xl border border-slate-800 text-center space-y-3">
          <p className="text-sm font-bold text-white">
            {offers.length === 0 ? 'No wholesale offers yet' : 'No offers match this filter'}
          </p>
          {offers.length === 0 && (
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Let customers collectively reach your wholesale minimum quantity. Create a draft, set the wholesale price
              and quantity limits, and activate it whenever you're ready.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibleOffers.map((o) => (
            <button
              key={o.id}
              onClick={() => setView({ mode: 'detail', id: o.id })}
              className="glass-card p-4 rounded-3xl border border-slate-800 hover:border-indigo-600 transition text-left flex gap-4"
            >
              <div className="w-16 h-16 rounded-xl bg-slate-800 overflow-hidden shrink-0 border border-slate-700 flex items-center justify-center">
                {o.productImageUrl ? (
                  <img src={o.productImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-6 h-6 text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-1.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-white truncate">{o.productName}</span>
                  <OfferStatusBadge status={o.status} />
                </div>
                <p className="text-slate-400 truncate">
                  {formatMoney(o.productPrice)} → <span className="text-emerald-400 font-bold">{formatMoney(o.wholesaleUnitPrice)}</span>{' '}
                  wholesale · min {o.wholesaleMinimumQuantity} units
                </p>
                <p className="text-[10px] text-slate-500">
                  Deadline {formatDateTime(o.reservationDeadline)} · {o.activeLotCount} active lot
                  {o.activeLotCount === 1 ? '' : 's'} · {o.completedLotCount} completed
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, tone = 'default' }) {
  const tones = { default: 'text-white', good: 'text-emerald-300', warn: 'text-amber-300' };
  return (
    <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-1">
      <span className="text-[11px] text-slate-400 block font-semibold">{label}</span>
      <p className={`text-xl font-black font-mono ${tones[tone] || tones.default}`}>{value}</p>
    </div>
  );
}
