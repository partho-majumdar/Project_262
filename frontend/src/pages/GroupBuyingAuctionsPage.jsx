import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Gavel, Loader2, Package, Store, Ticket, Users } from 'lucide-react';
import { groupBuyingAuctionApi } from '../api/groupBuyingAuctionApi';
import { apiErrorMessage } from '../api/groupBuyApi';
import { useAuth } from '../context/AuthContext';
import useLiveReload, { topics } from '../components/groupbuy/useLiveReload';
import CountdownTimer from '../components/groupbuy/CountdownTimer';
import AuctionPriceLadder from '../components/auction/AuctionPriceLadder';
import { AuctionStatusBadge } from '../components/auction/AuctionStatusBadge';
import { formatMoney } from '../components/groupbuy/format';

export default function GroupBuyingAuctionsPage() {
  const { isAuthenticated } = useAuth();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await groupBuyingAuctionApi.getAuctions();
      setAuctions(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load auctions.'));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  useLiveReload([topics.GROUP_BUYING_AUCTION, topics.STOREFRONT], () => load(false));

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="glass-panel p-6 sm:p-10 rounded-3xl space-y-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950 border border-amber-500/30 text-amber-400 text-xs font-semibold">
          <Gavel className="w-3.5 h-3.5" /> Group Buying Auction
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          Bid together. The more units, the{' '}
          <span className="text-amber-400">cheaper everyone pays.</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
          State how many units you want and the most you will pay per unit. When the auction closes, the seller
          sets one price for everyone based on the total quantity bid. Bids above that price are not honoured and
          are refunded in full.
        </p>
        {isAuthenticated && (
          <Link
            to="/group-buying-auctions/my-bids"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition"
          >
            <Ticket className="w-3.5 h-3.5" /> My bids
          </Link>
        )}
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      ) : auctions.length === 0 ? (
        <div className="glass-card p-10 rounded-3xl border border-slate-800 text-center space-y-2">
          <Gavel className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-300">No auctions running right now</p>
          <p className="text-xs text-slate-500">Check back soon. Sellers open new collective auctions regularly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {auctions.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      )}
    </div>
  );
}

function AuctionCard({ auction }) {
  return (
    <Link
      to={`/group-buying-auctions/${auction.id}`}
      className="group glass-card rounded-3xl border border-slate-800 hover:border-amber-500/60 overflow-hidden flex flex-col transition"
    >
      <div className="relative aspect-[4/3] bg-slate-900 overflow-hidden">
        {auction.productImageUrl ? (
          <img
            src={auction.productImageUrl}
            alt={auction.productName}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            <Package className="w-10 h-10" />
          </div>
        )}
        <span className="absolute top-3 left-3">
          <AuctionStatusBadge status={auction.status} />
        </span>
        {auction.status === 'OPEN' && (
          <span className="absolute top-3 right-3 px-2 py-1 rounded-full bg-slate-950/80 border border-slate-700">
            <CountdownTimer expiresAt={auction.endsAt} variant="compact" />
          </span>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-extrabold text-white line-clamp-1">{auction.productName}</h3>
          <p className="text-[10px] text-slate-500 flex items-center gap-1">
            <Store className="w-3 h-3" /> {auction.sellerStoreName}
          </p>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-xl font-extrabold text-amber-400 font-mono">
            {auction.finalized
              ? formatMoney(auction.finalUnitPrice)
              : formatMoney(auction.projectedUnitPrice ?? auction.startingPrice)}
          </span>
          <span className="text-[10px] text-slate-400">
            {auction.finalized ? 'final price / unit' : 'projected price / unit'}
          </span>
        </div>

        <AuctionPriceLadder auction={auction} compact />

        <p className="text-[10px] text-slate-500 flex items-center gap-1">
          <Users className="w-3 h-3" /> {auction.collectiveQuantity} of {auction.minimumCollectiveQuantity} units bid
          · {auction.participantCount} bidders
        </p>

        <span className="mt-auto inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-600 group-hover:bg-amber-500 text-white text-xs font-bold transition">
          View auction <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}
