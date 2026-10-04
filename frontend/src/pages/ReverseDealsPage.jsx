import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Loader2, Package, Sparkles, Store, Target, Ticket } from 'lucide-react';
import { reverseGroupBuyingApi } from '../api/reverseGroupBuyingApi';
import { apiErrorMessage } from '../api/groupBuyApi';
import { useAuth } from '../context/AuthContext';
import useLiveReload, { topics } from '../components/groupbuy/useLiveReload';
import CountdownTimer from '../components/groupbuy/CountdownTimer';
import ReverseTargetProgress from '../components/reverse/ReverseTargetProgress';
import { RgbStatusBadge } from '../components/reverse/RgbStatusBadge';
import { describeRgbTarget } from '../components/reverse/reverseMeta';
import { formatMoney } from '../components/groupbuy/format';

export default function ReverseDealsPage() {
  const { isAuthenticated } = useAuth();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await reverseGroupBuyingApi.getOffers();
      setOffers(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load reverse group buying offers.'));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  useLiveReload([topics.REVERSE_GROUP_BUYING, topics.STOREFRONT], () => load(false));

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="glass-panel p-6 sm:p-10 rounded-3xl space-y-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
          <Target className="w-3.5 h-3.5" /> Reverse Group Buying
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          The seller needs demand. <span className="text-cyan-400">You supply it.</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
          Each offer states a purchasing condition a seller will only honour once enough customers collectively
          demand it. Commit the quantity you actually want — your units are reserved straight away and fully
          refunded if the condition is never met.
        </p>
        <p className="text-[11px] text-slate-500 max-w-2xl">
          This is a demand target, not a group order. You keep your own order, payment and delivery.
        </p>
        {isAuthenticated && (
          <Link
            to="/reverse-group-buying/my-demand"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition"
          >
            <Ticket className="w-3.5 h-3.5" /> My demand
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
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      ) : offers.length === 0 ? (
        <div className="glass-card p-10 rounded-3xl border border-slate-800 text-center space-y-2">
          <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-300">No reverse group buying offers right now</p>
          <p className="text-xs text-slate-500">Check back soon. Sellers publish new demand targets regularly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </div>
  );
}

function OfferCard({ offer }) {
  return (
    <Link
      to={`/reverse-group-buying/offers/${offer.id}`}
      className="group glass-card rounded-3xl border border-slate-800 hover:border-cyan-500/60 overflow-hidden flex flex-col transition"
    >
      <div className="relative aspect-[4/3] bg-slate-900 overflow-hidden">
        {offer.productImageUrl ? (
          <img
            src={offer.productImageUrl}
            alt={offer.productName}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            <Package className="w-10 h-10" />
          </div>
        )}
        <span className="absolute top-3 left-3">
          <RgbStatusBadge status={offer.status} />
        </span>
        {offer.acceptsDemand && (
          <span className="absolute top-3 right-3 px-2 py-1 rounded-full bg-slate-950/80 border border-slate-700">
            <CountdownTimer expiresAt={offer.participationDeadline} variant="compact" />
          </span>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-extrabold text-white line-clamp-1">{offer.productName}</h3>
          <p className="text-[10px] text-slate-500 flex items-center gap-1">
            <Store className="w-3 h-3" /> {offer.sellerStoreName}
          </p>
        </div>

        <p className="text-[11px] text-cyan-300 font-semibold">{describeRgbTarget(offer)}</p>

        <div className="flex items-baseline gap-2">
          <span className="text-xl font-extrabold text-emerald-400 font-mono">
            {formatMoney(offer.unlockedUnitPrice)}
          </span>
          <span className="text-[10px] text-slate-400 line-through">{formatMoney(offer.basePrice)}</span>
        </div>

        <ReverseTargetProgress
          currentDemand={offer.currentDemand}
          targetQuantity={offer.targetQuantity}
          compact
        />

        <p className="text-[10px] text-slate-500">
          {offer.participantCount} participating · {offer.minQuantityPerCustomer}–{offer.maxQuantityPerCustomer} units
          per customer
        </p>

        <span className="mt-auto inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-cyan-600 group-hover:bg-cyan-500 text-white text-xs font-bold transition">
          View offer <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}
