import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Gavel, Plus, RefreshCw, X } from 'lucide-react';
import axiosClient from '../../../api/axiosClient';
import { sellerAuctionApi } from '../../../api/groupBuyingAuctionApi';
import { apiErrorMessage } from '../../../api/groupBuyApi';
import { formatDateTime, formatMoney } from '../../groupbuy/format';
import AuctionForm from './AuctionForm';
import AuctionDetail from './AuctionDetail';
import { AuctionStatusBadge } from '../../auction/AuctionStatusBadge';
import { AUCTION_FILTERS } from '../../auction/auctionMeta';

const listOf = (res) => (Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []);

const ACTION_MESSAGES = {
  publish: 'Auction published. Bidders can now commit bids.',
  finalize: 'Auction finalized. Winning bids became orders; the rest were refunded.',
  cancel: 'Auction cancelled. Every bid was refunded and the stock released.',
};

export default function SellerAuctionTab() {
  const [auctions, setAuctions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // view: { mode: 'list' } | { mode: 'form', auction? } | { mode: 'detail', id }
  const [view, setView] = useState({ mode: 'list' });
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const [auctionRes, productRes] = await Promise.allSettled([
      sellerAuctionApi.getAuctions(),
      axiosClient.get('/seller/products'),
    ]);
    if (auctionRes.status === 'fulfilled') setAuctions(listOf(auctionRes.value));
    else setError(apiErrorMessage(auctionRes.reason, 'Could not load group buying auctions'));
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

  const handleSave = async (payload, publishNow) => {
    setBusy(true);
    setFormError('');
    const existing = view.auction;
    let saved;
    try {
      saved = existing
        ? await sellerAuctionApi.updateAuction(existing.id, payload)
        : await sellerAuctionApi.createAuction(payload);
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not save the auction'));
      setBusy(false);
      return;
    }
    try {
      if (publishNow) await sellerAuctionApi.publishAuction(saved.id);
      flash(publishNow ? 'Saved and published.' : 'Saved as draft.');
    } catch (err) {
      setNotice('');
      setError(`Saved as draft, but publishing failed: ${apiErrorMessage(err)}`);
    }
    await load({ silent: true });
    setView({ mode: 'detail', id: saved.id });
    setBusy(false);
  };

  const handleAction = async (action, auction, reason) => {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      if (action === 'publish') await sellerAuctionApi.publishAuction(auction.id);
      if (action === 'finalize') await sellerAuctionApi.finalizeAuction(auction.id);
      if (action === 'cancel') await sellerAuctionApi.cancelAuction(auction.id, reason);
      flash(ACTION_MESSAGES[action]);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
    await load({ silent: true });
    setBusy(false);
  };

  const stats = useMemo(() => {
    const count = (statuses) => auctions.filter((a) => statuses.includes(a.status)).length;
    return {
      open: count(['OPEN']),
      scheduled: count(['SCHEDULED']),
      drafts: count(['DRAFT']),
      bidUnits: auctions.reduce((sum, a) => sum + (a.collectiveQuantity || 0), 0),
    };
  }, [auctions]);

  const visibleAuctions = useMemo(() => {
    const statuses = AUCTION_FILTERS.find((f) => f.id === filter)?.statuses;
    return statuses ? auctions.filter((a) => statuses.includes(a.status)) : auctions;
  }, [auctions, filter]);

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
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-3" /> Loading auctions…
      </div>
    );
  }

  if (view.mode === 'form') {
    return (
      <div className="space-y-4">
        {banner}
        <AuctionForm
          key={view.auction?.id || 'new'}
          auction={view.auction}
          products={products}
          saving={busy}
          serverError={formError}
          onSave={handleSave}
          onCancel={() => {
            setFormError('');
            setView(view.auction ? { mode: 'detail', id: view.auction.id } : { mode: 'list' });
          }}
        />
      </div>
    );
  }

  const detailAuction = view.mode === 'detail' ? auctions.find((a) => a.id === view.id) : null;
  if (detailAuction) {
    return (
      <div className="space-y-4">
        {banner}
        <AuctionDetail
          auction={detailAuction}
          busy={busy}
          refreshKey={refreshKey}
          onBack={() => setView({ mode: 'list' })}
          onEdit={(auction) => {
            setFormError('');
            setView({ mode: 'form', auction });
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
        <h2 className="text-sm font-black text-white">Group Buying Auctions</h2>
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
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-600/20"
          >
            <Plus className="w-4 h-4" /> New auction
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 max-w-3xl">
        Run a timed auction where bidders compete on the maximum price they will accept. One collective price is
        calculated from the total quantity bid; bids above it are refunded and their units released.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Open for bids" value={stats.open} tone="good" />
        <StatTile label="Scheduled" value={stats.scheduled} tone="warn" />
        <StatTile label="Drafts" value={stats.drafts} />
        <StatTile label="Units bid" value={stats.bidUnits} />
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        {AUCTION_FILTERS.map((f) => {
          const n = f.statuses ? auctions.filter((a) => f.statuses.includes(a.status)).length : auctions.length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full border font-bold transition ${
                filter === f.id
                  ? 'bg-amber-600 border-amber-500 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {f.label} ({n})
            </button>
          );
        })}
      </div>

      {visibleAuctions.length === 0 ? (
        <div className="glass-panel p-10 rounded-3xl border border-slate-800 text-center space-y-3">
          <p className="text-sm font-bold text-white">
            {auctions.length === 0 ? 'No group buying auctions yet' : 'No auctions match this filter'}
          </p>
          {auctions.length === 0 && (
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Create a draft, choose a collective pricing rule, set the minimum quantity and time window, then
              publish it whenever you're ready.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibleAuctions.map((a) => (
            <button
              key={a.id}
              onClick={() => setView({ mode: 'detail', id: a.id })}
              className="glass-card p-4 rounded-3xl border border-slate-800 hover:border-amber-600 transition text-left flex gap-4"
            >
              <div className="w-16 h-16 rounded-xl bg-slate-800 overflow-hidden shrink-0 border border-slate-700 flex items-center justify-center">
                {a.productImageUrl ? (
                  <img src={a.productImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Gavel className="w-6 h-6 text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-1.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-white truncate">{a.productName}</span>
                  <AuctionStatusBadge status={a.status} />
                </div>
                <p className="text-slate-400 truncate">
                  {a.finalized ? (
                    <>
                      Final <span className="text-emerald-400 font-bold">{formatMoney(a.finalUnitPrice)}</span> / unit
                    </>
                  ) : (
                    <>
                      From {formatMoney(a.startingPrice)} · now projecting{' '}
                      <span className="text-amber-400 font-bold">{formatMoney(a.projectedUnitPrice ?? a.startingPrice)}</span>
                    </>
                  )}
                </p>
                <p className="text-amber-300 font-semibold flex items-center gap-1">
                  <Gavel className="w-3 h-3 shrink-0" /> {a.collectiveQuantity} of {a.minimumCollectiveQuantity} units
                  bid · {a.participantCount} bidder{a.participantCount === 1 ? '' : 's'}
                </p>
                <p className="text-[10px] text-slate-500">Closes {formatDateTime(a.endsAt)}</p>
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
