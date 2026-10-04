import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Boxes, CheckCircle2, Loader2, Package, ShieldCheck, Store, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { wholesaleApi } from '../api/wholesaleApi';
import { apiErrorMessage } from '../api/groupBuyApi';
import useLiveReload, { topics } from '../components/groupbuy/useLiveReload';
import CountdownTimer from '../components/groupbuy/CountdownTimer';
import { formatDateTime, formatMoney } from '../components/groupbuy/format';
import WholesalePoolProgress from '../components/wholesale/WholesalePoolProgress';
import WholesaleSharePanel from '../components/wholesale/WholesaleSharePanel';
import ReserveWholesaleModal from '../components/wholesale/ReserveWholesaleModal';
import { poolAcceptsReservations } from '../components/seller/wholesale/wholesaleMeta';

const STATUS_TEXT = {
  COMPLETED: 'This pool reached its wholesale minimum. Orders are being prepared.',
  PROCESSING: 'This pool completed and orders were created. The seller is preparing fulfillment.',
  FULFILLMENT: 'Orders from this pool are being processed and shipped.',
  CLOSED: 'This pool is no longer accepting reservations.',
  FAILED: 'This pool did not reach its wholesale minimum before the deadline and was cancelled. Reservations were refunded.',
};

export default function WholesalePoolDetailPage() {
  const { poolId } = useParams();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [pool, setPool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReserve, setShowReserve] = useState(false);

  const load = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        setPool(await wholesaleApi.getPool(poolId));
        setError('');
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not load this wholesale pool.'));
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [poolId],
  );

  useEffect(() => {
    load(true);
  }, [load]);

  useLiveReload([topics.WHOLESALE], () => load(false), { enabled: !!pool && !showReserve });

  const openReserve = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location, message: 'Sign in to reserve wholesale quantity.' } });
      return;
    }
    setShowReserve(true);
  };

  const handleReserved = () => {
    setShowReserve(false);
    navigate('/wholesale/my-reservations', { state: { justReserved: true } });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl text-rose-300 text-sm">
          {error || 'Wholesale pool not found'}
        </div>
        <Link to="/wholesale" className="inline-flex items-center gap-2 text-indigo-400 hover:underline text-xs font-semibold">
          <ArrowLeft className="w-4 h-4" /> Back to wholesale
        </Link>
      </div>
    );
  }

  const statusText = STATUS_TEXT[pool.status];
  const canReserve = poolAcceptsReservations(pool.status) && pool.remainingQuantity > 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <Link to="/wholesale" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white">
        <ArrowLeft className="w-4 h-4" /> All wholesale pools
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2 space-y-3">
          <div className="aspect-square rounded-3xl overflow-hidden bg-slate-900 border border-slate-800">
            {pool.productImageUrl ? (
              <img src={pool.productImageUrl} alt={pool.productName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600">
                <Package className="w-12 h-12" />
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-5">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-700 text-indigo-300 text-[11px] font-bold">
              <Boxes className="w-3.5 h-3.5" /> Wholesale pool · Lot #{pool.lotNumber}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{pool.productName}</h1>
            <p className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
              <Store className="w-3.5 h-3.5 text-indigo-400" /> {pool.sellerStoreName}
            </p>
          </div>

          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-500">Wholesale price</p>
              <span className="text-3xl font-extrabold text-emerald-400 font-mono">{formatMoney(pool.wholesaleUnitPrice)}</span>
              <span className="text-xs text-slate-500"> / unit</span>
            </div>
            <CountdownTimer expiresAt={pool.deadline} label="Reservation deadline" onExpire={() => load(false)} />
          </div>

          <WholesalePoolProgress pooledQuantity={pool.pooledQuantity} wholesaleMinimumQuantity={pool.wholesaleMinimumQuantity} />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            {[
              ['Units pooled', pool.pooledQuantity],
              ['Units remaining', pool.remainingQuantity],
              ['Participants', pool.participantCount],
              ['Lot capacity', pool.lotCapacity],
            ].map(([label, value]) => (
              <div key={label} className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
                <p className="font-mono text-lg font-extrabold text-white">{value}</p>
                <p className="text-[10px] text-slate-500 font-semibold">{label}</p>
              </div>
            ))}
          </div>

          {statusText && (
            <div className="p-3 bg-amber-950/40 border border-amber-800/70 rounded-2xl text-xs text-amber-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {statusText}
            </div>
          )}

          {canReserve ? (
            <button
              type="button"
              onClick={openReserve}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm shadow-lg shadow-indigo-900/40 transition flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Reserve your quantity
            </button>
          ) : (
            !statusText && <p className="text-xs text-slate-500 text-center">This pool is no longer accepting reservations.</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-400">
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-2">
              <Users className="w-4 h-4 text-indigo-400 shrink-0" /> {pool.minQuantityPerCustomer}–{pool.maxQuantityPerCustomer} units per customer
            </div>
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" /> Full refund if the minimum isn't reached in time
            </div>
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-2">
              <Package className="w-4 h-4 text-amber-400 shrink-0" /> Your own order, payment and delivery — always
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <aside className="lg:col-start-3 glass-card p-5 rounded-3xl border border-slate-800 self-start space-y-4">
          <WholesaleSharePanel pool={pool} />
          <p className="text-[11px] text-slate-500 border-t border-slate-800 pt-3">
            Deadline {formatDateTime(pool.deadline)}. Bring more demand into this pool instead of creating a new one.
          </p>
        </aside>
      </div>

      <ReserveWholesaleModal isOpen={showReserve} pool={pool} onClose={() => setShowReserve(false)} onSuccess={handleReserved} />
    </div>
  );
}
