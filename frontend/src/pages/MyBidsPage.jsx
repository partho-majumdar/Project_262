import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Gavel, Loader2 } from 'lucide-react';
import { auctionApi, AUCTION_POLL_MS } from '../api/auctionApi';
import { apiErrorMessage } from '../api/groupBuyApi';
import useLiveReload, { topics } from '../components/groupbuy/useLiveReload';
import { formatMoney, formatDateTime } from '../components/groupbuy/format';
import ProxyAuctionCard, { shortDuration } from '../components/proxyAuction/ProxyAuctionCard';
import { AuctionStatusBadge } from '../components/proxyAuction/AuctionStatusBadge';

const TABS = [
  { id: 'leading', label: 'Leading' },
  { id: 'outbid', label: 'Outbid' },
  { id: 'settled', label: 'Won / Lost' },
  { id: 'all', label: 'All Bids' },
];

/**
 * Everything the signed-in customer has authorised, and where each bid currently stands.
 *
 * The only page in the product that shows a private maximum, and only to the person who set it.
 */
export default function MyBidsPage() {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('leading');

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await auctionApi.getMyBids();
      setBids(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your bids.'));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  useLiveReload([topics.AUCTION], () => load(false));

  const grouped = useMemo(
    () => ({
      leading: bids.filter((b) => b.status === 'WINNING' || b.winning),
      outbid: bids.filter((b) => b.status === 'OUTBID'),
      settled: bids.filter((b) => ['WON', 'LOST', 'CANCELLED'].includes(b.status)),
      all: bids,
    }),
    [bids],
  );

  const visible = grouped[tab] || [];

  return (
    <div className="space-y-5">
      <header className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-2">
        <div className="flex items-center gap-2">
          <Gavel className="w-6 h-6 text-amber-400" />
          <h1 className="text-xl font-extrabold text-white">My Bids</h1>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
          Your maximums are shown here and nowhere else. Each card tells you what you are currently
          committed to, which is normally well below what you authorised.
        </p>
      </header>

      {error && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              tab === item.id
                ? 'bg-amber-600 border-amber-500 text-white'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {item.label} ({(grouped[item.id] || []).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="glass-card p-10 rounded-3xl border border-slate-800 text-center space-y-2">
          <Gavel className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm text-slate-300">No bids in this group.</p>
          <Link to="/auctions" className="inline-block text-xs text-amber-400 hover:text-amber-300">
            Browse open auctions
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((bid) => (
            <ProxyAuctionCard
              key={bid.bidId}
              auction={{
                ...bid,
                productName: bid.productName,
                status: bid.auctionStatus,
                currentPrice: bid.currentPrice,
                minimumNextBid: bid.minimumNextBid,
                timeRemainingSeconds: bid.timeRemainingSeconds,
              }}
              bid={bid}
              footer={
                <div className="pt-2 border-t border-slate-800 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between">
                    <AuctionStatusBadge status={bid.bidStatus} kind="bid" />
                    {bid.outcome && <span className="text-slate-400">{bid.outcome}</span>}
                  </div>
                  {bid.auctionStatus === 'LIVE' ? (
                    <p className="text-slate-500">
                      Ends in {shortDuration(bid.timeRemainingSeconds)} &middot;{' '}
                      {formatDateTime(bid.endsAt)}
                    </p>
                  ) : (
                    bid.finalPrice != null && (
                      <p className="text-slate-400">
                        Final price: <span className="font-mono">{formatMoney(bid.finalPrice)}</span>
                      </p>
                    )
                  )}
                  {bid.orderNumber && (
                    <Link
                      to={`/orders/confirmation/${bid.orderNumber}`}
                      className="block text-center py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-bold"
                    >
                      View order {bid.orderNumber}
                    </Link>
                  )}
                </div>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
