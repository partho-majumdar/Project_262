import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Gavel, Loader2, Plus, RefreshCw } from 'lucide-react';
import axiosClient from '../../../api/axiosClient';
import { sellerAuctionApi } from '../../../api/auctionApi';
import { apiErrorMessage } from '../../../api/groupBuyApi';
import { formatMoney, formatDateTime } from '../../groupbuy/format';
import { AuctionStatusBadge } from '../../proxyAuction/AuctionStatusBadge';
import ProxyAuctionForm from './ProxyAuctionForm';
import SellerAuctionBids from './SellerAuctionBids';
import { shortDuration } from '../../proxyAuction/ProxyAuctionCard';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'DRAFT', label: 'Drafts' },
  { id: 'LIVE', label: 'Live' },
  { id: 'SCHEDULED', label: 'Scheduled' },
  { id: 'settled', label: 'Settled' },
];

const SETTLED = ['ENDED', 'SOLD', 'RESERVE_NOT_MET', 'CANCELLED'];

const listOf = (res) => {
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

/**
 * "My Auctions" in the seller dashboard.
 *
 * The seller's own view is the only place a reserve price and a winning bidder's real name appear -
 * which is exactly the information a seller is entitled to and a bidder is not. Everything shown
 * here comes from the seller endpoints, so the frontend never has to reconstruct privileged data
 * from the public payload.
 */
export default function SellerProxyAuctionTab() {
  const [view, setView] = useState({ mode: 'list' });
  const [auctions, setAuctions] = useState([]);
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const [auctionRes, productRes] = await Promise.allSettled([
      sellerAuctionApi.getMyAuctions(),
      axiosClient.get('/seller/products'),
    ]);
    if (auctionRes.status === 'fulfilled') setAuctions(listOf(auctionRes.value));
    else setError(apiErrorMessage(auctionRes.reason, 'Could not load your auctions.'));
    if (productRes.status === 'fulfilled') setProducts(listOf(productRes.value));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    if (filter === 'all') return auctions;
    if (filter === 'settled') return auctions.filter((a) => SETTLED.includes(a.status));
    return auctions.filter((a) => a.status === filter);
  }, [auctions, filter]);

  const counts = useMemo(() => {
    const tally = { all: auctions.length, settled: 0 };
    FILTERS.forEach((f) => {
      if (f.id !== 'all' && f.id !== 'settled') {
        tally[f.id] = auctions.filter((a) => a.status === f.id).length;
      }
    });
    tally.settled = auctions.filter((a) => SETTLED.includes(a.status)).length;
    return tally;
  }, [auctions]);

  // Every action reports back through one place so the seller always knows what the server decided.
  const act = async (label, action, successMessage) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      await load({ silent: true });
      setNotice(successMessage);
    } catch (err) {
      setError(apiErrorMessage(err, `${label} failed.`));
    } finally {
      setBusy(false);
    }
  };

  const save = async (payload) => {
    setBusy(true);
    setError(null);
    try {
      if (view.auction) await sellerAuctionApi.update(view.auction.id, payload);
      else await sellerAuctionApi.create(payload);
      setView({ mode: 'list' });
      await load({ silent: true });
      setNotice(view.auction ? 'Auction updated.' : 'Auction created as a draft. Publish it when ready.');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the auction.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <Gavel className="w-5 h-5 text-amber-400" /> My Auctions
          </h2>
          <p className="text-[11px] text-slate-500">
            Sealed-bid proxy lots. Bidders authorise a private maximum; you always see the resulting price.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load()}
            disabled={loading}
            className="px-3 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setView({ mode: 'form' })}
            className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> New Auction
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-2xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-800 rounded-2xl text-emerald-300 text-xs">
          {notice}
        </div>
      )}

      {view.mode === 'form' && (
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          {products.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              You need at least one product in your catalog before you can auction a lot.
            </p>
          ) : (
            <ProxyAuctionForm
              products={products}
              auction={view.auction}
              onSubmit={save}
              onCancel={() => setView({ mode: 'list' })}
              busy={busy}
            />
          )}
        </div>
      )}

      {view.mode === 'list' && (
        <>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  filter === item.id
                    ? 'bg-amber-600 border-amber-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {item.label} ({counts[item.id] || 0})
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-7 h-7 text-amber-500 animate-spin" />
            </div>
          ) : visible.length === 0 ? (
            <div className="glass-card p-10 rounded-2xl border border-slate-800 text-center space-y-2">
              <Gavel className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-300">No auctions in this view.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map((auction) => (
                <div
                  key={auction.id}
                  className="glass-card p-4 rounded-2xl border border-slate-800 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white truncate">{auction.productName}</h3>
                        <AuctionStatusBadge status={auction.status} />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {auction.bidCount ?? 0} bid(s) from {auction.bidderCount ?? 0} bidder(s) &middot;{' '}
                        {auction.endsAt ? formatDateTime(auction.endsAt) : 'No end time'}
                        {auction.status === 'LIVE' && auction.timeRemainingSeconds != null
                          ? ` (${shortDuration(auction.timeRemainingSeconds)} left)`
                          : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">
                        {auction.status === 'SOLD' ? 'Sold for' : 'Current price'}
                      </p>
                      <p className="font-mono text-base font-bold text-amber-400">
                        {formatMoney(auction.status === 'SOLD' ? auction.finalPrice : auction.currentPrice)}
                      </p>
                    </div>
                  </div>

                  {/* The seller sees what bidders cannot: the floor they set, and whether it is met. */}
                  {auction.reservePrice != null && (
                    <div className="flex flex-wrap gap-3 text-[11px]">
                      <span className="text-slate-400">
                        Reserve (seller only):{' '}
                        <span className="font-mono text-slate-200">{formatMoney(auction.reservePrice)}</span>
                      </span>
                      <span className={auction.reserveMet ? 'text-emerald-400' : 'text-slate-500'}>
                        {auction.reserveMet ? 'Met' : 'Not met yet'}
                      </span>
                    </div>
                  )}

                  {auction.winnerName && (
                    <div className="p-2.5 bg-amber-950/30 border border-amber-900/60 rounded-xl text-[11px] text-amber-200">
                      Won by {auction.winnerName}
                      {auction.winnerEmail ? ` (${auction.winnerEmail})` : ''} at{' '}
                      {formatMoney(auction.finalPrice)} per unit
                      {auction.winnerOrderNumber ? ` - order ${auction.winnerOrderNumber}` : ''}
                    </div>
                  )}

                  {auction.closeNote && (
                    <p className="text-[11px] text-slate-500">
                      {auction.closeNote}
                      {auction.closeCodeLabel ? ` (${auction.closeCodeLabel})` : ''}
                    </p>
                  )}

                  {view.mode === 'list' && view.auction && (
                    <SellerAuctionBids
                      auction={view.auction}
                      onClose={() => setView({ mode: 'list' })}
                    />
                  )}

                  <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-3">
                    <Action
                      label="View bids"
                      disabled={busy || (auction.bidCount ?? 0) === 0}
                      onClick={() => setView({ mode: 'list', auction })}
                    />
                    {auction.status === 'DRAFT' && (
                      <>
                        <Action
                          label="Publish"
                          disabled={busy}
                          onClick={() =>
                            act('Publish', () => sellerAuctionApi.publish(auction.id), 'Auction published.')
                          }
                        />
                        <Action
                          label="Edit"
                          disabled={busy}
                          onClick={() => setView({ mode: 'form', auction })}
                        />
                      </>
                    )}
                    {auction.status === 'SCHEDULED' && (
                      <Action
                        label="Cancel auction"
                        disabled={busy}
                        tone="danger"
                        onClick={() =>
                          act(
                            'Cancel',
                            () => sellerAuctionApi.cancel(auction.id, 'Cancelled by the seller'),
                            'Auction cancelled and the lot returned to stock.',
                          )
                        }
                      />
                    )}
                    {auction.status === 'LIVE' && (
                      <Action
                        label="Close early"
                        disabled={busy}
                        onClick={() =>
                          act(
                            'Close',
                            () => sellerAuctionApi.close(auction.id),
                            'Auction closed. The proxy price and the reserve have been applied.',
                          )
                        }
                      />
                    )}
                    <Action
                      label="Cancel auction"
                      disabled={busy || !['DRAFT', 'SCHEDULED', 'LIVE'].includes(auction.status)}
                      tone="danger"
                      onClick={() =>
                        act(
                          'Cancel',
                          () => sellerAuctionApi.cancel(auction.id, 'Cancelled by the seller'),
                          'Auction cancelled and the lot returned to stock.',
                        )
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Action({ label, onClick, disabled, tone = 'default' }) {
  const styles =
    tone === 'danger'
      ? 'bg-rose-950/60 border-rose-800 text-rose-300 hover:bg-rose-900/60'
      : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 border rounded-xl text-[11px] font-semibold disabled:opacity-40 ${styles}`}
    >
      {label}
    </button>
  );
}
