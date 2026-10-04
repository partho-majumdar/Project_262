import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Gavel, Loader2, Search, ShieldQuestion } from 'lucide-react';
import { auctionApi, AUCTION_POLL_MS } from '../api/auctionApi';
import { apiErrorMessage } from '../api/groupBuyApi';
import useLiveReload, { topics } from '../components/groupbuy/useLiveReload';
import ProxyAuctionCard from '../components/proxyAuction/ProxyAuctionCard';
import { auctionBucket, BUCKET_LABEL } from '../components/proxyAuction/proxyAuctionMeta';

/**
 * The public front of the proxy auction: every live, scheduled and recently closed lot.
 *
 * Readable without signing in, and polling keeps the prices honest while somebody is watching a
 * countdown. Nothing on this page reveals who is bidding or what they authorised - that separation
 * is enforced on the server, and this view simply never asks for it.
 */
export default function AuctionMarketplacePage() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bucket, setBucket] = useState('live');
  const [query, setQuery] = useState('');

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await auctionApi.getAuctions();
      setAuctions(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load the auction list.'));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  // A live price is only meaningful if it keeps up, so refresh on a timer.
  useLiveReload([topics.AUCTION, topics.STOREFRONT], () => load(false));

  const counts = useMemo(() => {
    const tally = { live: 0, scheduled: 0, closed: 0, draft: 0 };
    auctions.forEach((a) => {
      tally[auctionBucket(a)] += 1;
    });
    return tally;
  }, [auctions]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return auctions
      .filter((a) => auctionBucket(a) === bucket)
      .filter((a) => {
        if (!needle) return true;
        return (
          (a.productName || '').toLowerCase().includes(needle) ||
          (a.sellerStoreName || '').toLowerCase().includes(needle)
        );
      });
  }, [auctions, bucket, query]);

  return (
    <div className="space-y-6">
      <header className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <Gavel className="w-6 h-6 text-amber-400" />
          <h1 className="text-xl font-extrabold text-white">Auctions</h1>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
          Set the most you are willing to pay. GroupMart bids on your behalf, one increment at a time,
          and stops the moment a rival stops pushing. Your maximum stays private - the public price
          only ever moves because a second bidder forced it.
        </p>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <ShieldQuestion className="w-3.5 h-3.5 shrink-0" />
          Bidders appear under pseudonyms, and a reserve price is never disclosed while an auction runs.
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {Object.entries(BUCKET_LABEL)
            .filter(([key]) => key !== 'closed' || counts.closed > 0)
            .map(([key, label]) => (
              <button
                key={key}
                onClick={() => setBucket(key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  bucket === key
                    ? 'bg-amber-600 border-amber-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {label} ({counts[key] || 0})
              </button>
            ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lots or stores"
            className="w-full sm:w-64 bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:border-amber-500"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="glass-card p-10 rounded-3xl border border-slate-800 text-center space-y-2">
          <Gavel className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm text-slate-300">Nothing here right now.</p>
          <p className="text-xs text-slate-500">
            {bucket === 'live'
              ? 'No lot is open for bidding at this moment. Check back shortly.'
              : 'Try a different tab or clear your search.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((auction) => (
            <ProxyAuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      )}

      <p className="text-center text-[11px] text-slate-600">
        Looking for the collective mechanism instead?{' '}
        <Link to="/group-buying-auctions" className="text-indigo-400 hover:text-indigo-300">
          Group Buying Auctions
        </Link>
      </p>
    </div>
  );
}
