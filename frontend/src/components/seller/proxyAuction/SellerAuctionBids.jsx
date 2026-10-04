import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Gavel, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { sellerAuctionApi } from '../../../api/auctionApi';
import { apiErrorMessage } from '../../../api/groupBuyApi';
import { formatMoney, formatDateTime, timeAgo } from '../../groupbuy/format';

/**
 * The seller's live view of who is bidding on one of their lots.
 *
 * The public bid ladder is deliberately anonymous, which left a seller unable to answer the two
 * questions that matter while an auction runs: who is ahead, and what did the price just move to.
 * This panel reads the privileged endpoint, which is the same data with the real bidder attached.
 *
 * Bids are already ordered leading-first by the server, and the leading row is called out, so the
 * current state of the auction is readable without interpreting the list.
 */

const STATUS_TONE = {
  WINNING: 'bg-emerald-900 text-emerald-300',
  OUTBID: 'bg-amber-900/70 text-amber-300',
  ACTIVE: 'bg-slate-800 text-slate-300',
  WON: 'bg-emerald-600 text-white',
  LOST: 'bg-slate-800 text-slate-400',
  CANCELLED: 'bg-rose-950 text-rose-300',
};

const STATUS_LABEL = {
  WINNING: 'Leading',
  OUTBID: 'Outbid',
  ACTIVE: 'Active',
  WON: 'Won',
  LOST: 'Lost',
  CANCELLED: 'Withdrawn',
};

export default function SellerAuctionBids({ auction, onClose }) {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const rows = await sellerAuctionApi.getDetailedBids(auction.id);
        setBids(Array.isArray(rows) ? rows : []);
        setError(null);
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not load the bids on this auction.'));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [auction?.id],
  );

  useEffect(() => {
    load();
  }, [load]);

  // A short poll, so the price and the leading bidder on screen track the live auction. Silent, so
  // it never replaces the panel with a spinner while the seller is reading it.
  useEffect(() => {
    if (auction?.status !== 'LIVE') return undefined;
    const id = setInterval(() => load(true), 10000);
    return () => clearInterval(id);
  }, [auction?.status, load]);

  const leading = useMemo(() => bids.find((b) => b.leading) || null, [bids]);
  const active = useMemo(() => bids.filter((b) => b.status !== 'CANCELLED'), [bids]);

  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Gavel className="w-4 h-4 text-amber-400" /> Bids on this lot
          </h3>
          <p className="text-[11px] text-slate-500">
            {active.length} active bid(s) from {new Set(active.map((b) => b.bidderEmail)).size} bidder(s).
            Only you can see the names and the maximums behind each bid.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load()}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl text-[11px] font-semibold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl text-[11px] font-semibold"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-2xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {leading && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded-2xl flex items-center gap-3">
          <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0 text-[11px]">
            <p className="text-emerald-200 font-semibold truncate">
              {leading.bidderName} is leading at {formatMoney(leading.amount)}
            </p>
            <p className="text-emerald-300/70">
              Authorised up to {formatMoney(leading.maximumBid)} &middot; current price{' '}
              {formatMoney(auction.status === 'SOLD' ? auction.finalPrice : auction.currentPrice)}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
        </div>
      ) : bids.length === 0 ? (
        <p className="text-xs text-slate-500 py-6 text-center">
          Nobody has bid on this lot yet. It is still at its opening price.
        </p>
      ) : (
        <div className="space-y-2">
          {bids.map((bid) => (
            <div
              key={bid.bidId}
              className={`p-3 rounded-xl border ${
                bid.leading
                  ? 'bg-emerald-950/30 border-emerald-800'
                  : 'bg-slate-900/40 border-slate-800'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-200 flex items-center gap-2 flex-wrap">
                    <span className="truncate">{bid.bidderName || 'Bidder'}</span>
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase ${
                        STATUS_TONE[bid.status] || 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {STATUS_LABEL[bid.status] || bid.status}
                    </span>
                    {bid.revised && (
                      <span className="px-1.5 py-0.5 bg-indigo-900/70 text-indigo-300 text-[9px] font-bold rounded uppercase">
                        Raised
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">{bid.bidderEmail}</p>
                  <p className="text-[10px] text-slate-500">
                    {timeAgo(bid.placedAt)} &middot; {formatDateTime(bid.placedAt)}
                    {bid.quantity > 1 ? ` \u00b7 ${bid.quantity} unit(s)` : ''}
                  </p>
                  {bid.cancellationReason && (
                    <p className="text-[10px] text-rose-300/80 mt-0.5">{bid.cancellationReason}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">
                    {bid.leading ? 'Committed to' : 'Authorised to'}
                  </p>
                  <p className="font-mono text-sm font-bold text-amber-400">
                    {formatMoney(bid.leading ? bid.amount : bid.maximumBid)}
                  </p>
                  {bid.leading && (
                    <p className="text-[10px] text-slate-500 font-mono">
                      max {formatMoney(bid.maximumBid)}
                    </p>
                  )}
                  {bid.amountPaid != null && (
                    <p className="text-[10px] text-emerald-400 font-mono">
                      paid {formatMoney(bid.amountPaid)}
                    </p>
                  )}
                  {bid.orderNumber && (
                    <p className="text-[10px] text-slate-500 font-mono">{bid.orderNumber}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
