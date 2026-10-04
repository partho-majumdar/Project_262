import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Boxes, Loader2, Package, Sparkles, Store, Ticket } from 'lucide-react';
import { wholesaleApi } from '../api/wholesaleApi';
import { apiErrorMessage } from '../api/groupBuyApi';
import { useAuth } from '../context/AuthContext';
import useLiveReload, { topics } from '../components/groupbuy/useLiveReload';
import CountdownTimer from '../components/groupbuy/CountdownTimer';
import WholesalePoolProgress from '../components/wholesale/WholesalePoolProgress';
import { formatMoney } from '../components/groupbuy/format';

export default function WholesaleDealsPage() {
  const { isAuthenticated } = useAuth();
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await wholesaleApi.getPools();
      setPools(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load wholesale pools.'));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  useLiveReload([topics.WHOLESALE, topics.STOREFRONT], () => load(false));

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="glass-panel p-6 sm:p-10 rounded-3xl relative overflow-hidden space-y-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
          <Boxes className="w-3.5 h-3.5 text-indigo-400" /> Collaborative Wholesale Purchasing
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          Unlock wholesale prices, <span className="text-indigo-400">together.</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
          Reserve just the quantity you need. Once enough customers combine their reservations to reach the
          seller's wholesale minimum, everyone gets the wholesale price — with their own order, payment and
          delivery. No teams or invite codes needed.
        </p>
        {isAuthenticated && (
          <Link
            to="/wholesale/my-reservations"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition"
          >
            <Ticket className="w-3.5 h-3.5" /> My reservations
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
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : pools.length === 0 ? (
        <div className="glass-card p-10 rounded-3xl border border-slate-800 text-center space-y-2">
          <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-300">No wholesale pools right now</p>
          <p className="text-xs text-slate-500">Check back soon. Sellers open new wholesale offers regularly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {pools.map((pool) => (
            <PoolCard key={pool.id} pool={pool} />
          ))}
        </div>
      )}
    </div>
  );
}

function PoolCard({ pool }) {
  return (
    <Link
      to={`/wholesale/pools/${pool.id}`}
      className="group glass-card rounded-3xl border border-slate-800 hover:border-indigo-500/60 overflow-hidden flex flex-col transition"
    >
      <div className="relative aspect-[4/3] bg-slate-900 overflow-hidden">
        {pool.productImageUrl ? (
          <img
            src={pool.productImageUrl}
            alt={pool.productName}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            <Package className="w-10 h-10" />
          </div>
        )}
        <span className="absolute top-3 right-3 px-2 py-1 rounded-full bg-slate-950/80 border border-slate-700">
          <CountdownTimer expiresAt={pool.deadline} variant="compact" />
        </span>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-extrabold text-white line-clamp-1">{pool.productName}</h3>
          <p className="text-[10px] text-slate-500 flex items-center gap-1">
            <Store className="w-3 h-3" /> {pool.sellerStoreName} · Lot #{pool.lotNumber}
          </p>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-xl font-extrabold text-emerald-400 font-mono">{formatMoney(pool.wholesaleUnitPrice)}</span>
          <span className="text-[10px] text-slate-400">wholesale price / unit</span>
        </div>

        <WholesalePoolProgress
          pooledQuantity={pool.pooledQuantity}
          wholesaleMinimumQuantity={pool.wholesaleMinimumQuantity}
          compact
        />

        <span className="mt-auto inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600 group-hover:bg-indigo-500 text-white text-xs font-bold transition">
          View pool <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}
