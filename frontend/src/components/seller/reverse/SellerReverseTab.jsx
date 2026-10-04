import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Package, Plus, RefreshCw, Target, X } from 'lucide-react';
import axiosClient from '../../../api/axiosClient';
import { sellerReverseGroupBuyingApi } from '../../../api/reverseGroupBuyingApi';
import { apiErrorMessage } from '../../../api/groupBuyApi';
import { formatDateTime, formatMoney } from '../../groupbuy/format';
import ReverseOfferForm from './ReverseOfferForm';
import ReverseOfferDetail from './ReverseOfferDetail';
import { RgbStatusBadge } from '../../reverse/RgbStatusBadge';
import ReverseTargetProgress from '../../reverse/ReverseTargetProgress';
import { RGB_OFFER_FILTERS, describeRgbTarget } from '../../reverse/reverseMeta';

const listOf = (res) => (Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []);

const ACTION_MESSAGES = {
  activate: 'Offer is live. Customers can now commit demand.',
  close: 'Offer closed. Active commitments were refunded and the reserved stock released.',
  fulfillment: 'Fulfillment started. The customers can track their orders.',
  complete: 'Offer completed.',
};

export default function SellerReverseTab() {
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
      sellerReverseGroupBuyingApi.getOffers(),
      axiosClient.get('/seller/products'),
    ]);
    if (offerRes.status === 'fulfilled') setOffers(listOf(offerRes.value));
    else setError(apiErrorMessage(offerRes.reason, 'Could not load reverse group buying offers'));
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
        ? await sellerReverseGroupBuyingApi.updateOffer(existing.id, payload)
        : await sellerReverseGroupBuyingApi.createOffer(payload);
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not save the offer'));
      setBusy(false);
      return;
    }
    try {
      if (activateNow) await sellerReverseGroupBuyingApi.activateOffer(saved.id);
      flash(activateNow ? 'Saved and activated. Customers can commit demand now.' : 'Saved as draft.');
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
      if (action === 'activate') await sellerReverseGroupBuyingApi.activateOffer(offer.id);
      if (action === 'close') await sellerReverseGroupBuyingApi.closeOffer(offer.id, reason);
      if (action === 'fulfillment') await sellerReverseGroupBuyingApi.startFulfillment(offer.id);
      if (action === 'complete') await sellerReverseGroupBuyingApi.completeOffer(offer.id);
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
      collecting: count(['OPEN', 'ALMOST_COMPLETE']),
      drafts: count(['DRAFT']),
      unlocked: count(['TARGET_REACHED', 'ACTIVATED', 'PROCESSING', 'FULFILLMENT', 'COMPLETED']),
      demand: offers.reduce((sum, o) => sum + (o.currentDemand || 0), 0),
    };
  }, [offers]);

  const visibleOffers = useMemo(() => {
    const statuses = RGB_OFFER_FILTERS.find((f) => f.id === filter)?.statuses;
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
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-500 mb-3" /> Loading reverse offers…
      </div>
    );
  }

  if (view.mode === 'form') {
    return (
      <div className="space-y-4">
        {banner}
        <ReverseOfferForm
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
        <ReverseOfferDetail
          offer={detailOffer}
          busy={busy}
          refreshKey={refreshKey}
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
        <h2 className="text-sm font-black text-white">Reverse Group Buying</h2>
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
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-cyan-600/20"
          >
            <Plus className="w-4 h-4" /> New reverse offer
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 max-w-3xl">
        Set a purchasing condition and the collective demand needed to unlock it. Individual customers commit their
        own quantity; when the target is met, each gets a separate order at the unlocked price. If the deadline
        passes first, every commitment is refunded.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Collecting demand" value={stats.collecting} tone="good" />
        <StatTile label="Drafts" value={stats.drafts} />
        <StatTile label="Unlocked or done" value={stats.unlocked} tone="good" />
        <StatTile label="Units of demand" value={stats.demand} />
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        {RGB_OFFER_FILTERS.map((f) => {
          const n = f.statuses ? offers.filter((o) => f.statuses.includes(o.status)).length : offers.length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full border font-bold transition ${
                filter === f.id
                  ? 'bg-cyan-600 border-cyan-500 text-white'
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
            {offers.length === 0 ? 'No reverse group buying offers yet' : 'No offers match this filter'}
          </p>
          {offers.length === 0 && (
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Create a draft, state the purchasing condition and how much collective demand unlocks it, then
              activate it whenever you're ready.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibleOffers.map((o) => (
            <button
              key={o.id}
              onClick={() => setView({ mode: 'detail', id: o.id })}
              className="glass-card p-4 rounded-3xl border border-slate-800 hover:border-cyan-600 transition text-left flex gap-4"
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
                  <RgbStatusBadge status={o.status} />
                </div>
                <p className="text-cyan-300 font-semibold truncate flex items-center gap-1">
                  <Target className="w-3 h-3 shrink-0" /> {describeRgbTarget(o)}
                </p>
                <p className="text-slate-400">
                  {formatMoney(o.productPrice)} → <span className="text-emerald-400 font-bold">{formatMoney(o.unlockedUnitPrice)}</span>{' '}
                  · {o.participantCount} customer{o.participantCount === 1 ? '' : 's'}
                </p>
                <ReverseTargetProgress currentDemand={o.currentDemand} targetQuantity={o.targetQuantity} compact />
                <p className="text-[10px] text-slate-500">Deadline {formatDateTime(o.participationDeadline)}</p>
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
