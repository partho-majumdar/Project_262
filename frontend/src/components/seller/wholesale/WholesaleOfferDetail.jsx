import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Clock, Edit3, Package, Pause, Play, RefreshCw, Zap, XCircle } from 'lucide-react';
import { sellerWholesaleApi } from '../../../api/wholesaleApi';
import { apiErrorMessage } from '../../../api/groupBuyApi';
import { formatDateTime, formatMoney } from '../../groupbuy/format';
import { OfferStatusBadge, PoolStatusBadge } from './WholesaleStatusBadge';
import { LotOrdersDisclosure } from './WholesaleLotOrders';
import {
  canActivateOffer,
  canCancelOffer,
  canEditOffer,
  canPauseOffer,
  canResumeOffer,
  isOfferDeadlinePassed,
} from './wholesaleMeta';

export default function WholesaleOfferDetail({ offer, busy, refreshKey, onBack, onEdit, onAction, onRefresh }) {
  const [pools, setPools] = useState([]);
  const [poolsLoading, setPoolsLoading] = useState(true);
  const [poolsError, setPoolsError] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const deadlinePassed = isOfferDeadlinePassed(offer);

  useEffect(() => {
    let ignore = false;
    setPoolsLoading(true);
    setPoolsError('');
    sellerWholesaleApi
      .getOfferPools(offer.id)
      .then((list) => !ignore && setPools(Array.isArray(list) ? list : []))
      .catch((err) => !ignore && setPoolsError(apiErrorMessage(err, 'Could not load wholesale lots')))
      .finally(() => !ignore && setPoolsLoading(false));
    return () => {
      ignore = true;
    };
  }, [offer.id, refreshKey]);

  const confirmCancel = () => {
    onAction('cancel', offer, cancelReason.trim());
    setCancelOpen(false);
    setCancelReason('');
  };

  const actionButton = 'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50';

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 font-bold">
        <ArrowLeft className="w-4 h-4" /> Back to wholesale offers
      </button>

      <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col md:flex-row gap-5">
        <div className="w-full md:w-28 h-28 rounded-2xl bg-slate-800 overflow-hidden shrink-0 border border-slate-700 flex items-center justify-center">
          {offer.productImageUrl ? (
            <img src={offer.productImageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Package className="w-8 h-8 text-slate-500" />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <OfferStatusBadge status={deadlinePassed && offer.status === 'ACTIVE' ? 'CLOSED' : offer.status} />
            {deadlinePassed && offer.status === 'ACTIVE' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-amber-700 bg-amber-950/60 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                <Clock className="w-3 h-3" /> Deadline passed — closing shortly
              </span>
            )}
            <span className="text-[10px] text-slate-500">Created {formatDateTime(offer.createdAt)}</span>
          </div>
          <h2 className="text-xl font-black text-white">{offer.productName}</h2>
          <p className="text-xs text-slate-400">
            {formatMoney(offer.productPrice)} regular → <strong className="text-emerald-300">{formatMoney(offer.wholesaleUnitPrice)}</strong>{' '}
            wholesale · minimum {offer.wholesaleMinimumQuantity} units · up to {offer.maxAvailableQuantity} per lot
          </p>
          <p className="text-[11px] text-slate-500">
            {offer.minQuantityPerCustomer}–{offer.maxQuantityPerCustomer} units per customer · deadline{' '}
            {formatDateTime(offer.reservationDeadline)}
          </p>
        </div>
        <div className="flex flex-wrap md:flex-col gap-2 md:items-stretch">
          {canEditOffer(offer.status) && (
            <button onClick={() => onEdit(offer)} disabled={busy} className={`${actionButton} bg-slate-900 border border-slate-700 hover:border-indigo-500 text-slate-100`}>
              <Edit3 className="w-4 h-4" /> Edit
            </button>
          )}
          {canActivateOffer(offer.status) && (
            <button onClick={() => onAction('activate', offer)} disabled={busy} className={`${actionButton} bg-indigo-600 hover:bg-indigo-500 text-white`}>
              <Zap className="w-4 h-4" /> Activate offer
            </button>
          )}
          {canPauseOffer(offer) && (
            <button onClick={() => onAction('pause', offer)} disabled={busy} className={`${actionButton} bg-orange-600 hover:bg-orange-500 text-white`}>
              <Pause className="w-4 h-4" /> Pause
            </button>
          )}
          {canResumeOffer(offer) && (
            <button onClick={() => onAction('resume', offer)} disabled={busy} className={`${actionButton} bg-emerald-600 hover:bg-emerald-500 text-white`}>
              <Play className="w-4 h-4" /> Resume
            </button>
          )}
          {canCancelOffer(offer.status) && (
            <button onClick={() => setCancelOpen((v) => !v)} disabled={busy} className={`${actionButton} bg-slate-900 border border-rose-800 hover:bg-rose-950 text-rose-300`}>
              <XCircle className="w-4 h-4" /> Cancel offer
            </button>
          )}
        </div>
      </div>

      {cancelOpen && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800 space-y-3 text-xs">
          <p className="font-bold text-rose-200">
            Cancelling refunds every active reservation across all open lots and releases reserved inventory. This can't
            be undone.
          </p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason (optional)"
            rows={2}
            className="w-full bg-slate-900 border border-rose-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
          />
          <div className="flex gap-2">
            <button onClick={confirmCancel} disabled={busy} className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold">
              Confirm cancellation
            </button>
            <button onClick={() => setCancelOpen(false)} className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-bold">
              Never mind
            </button>
          </div>
        </div>
      )}

      <div className="glass-card rounded-3xl border border-slate-800 p-5 space-y-4">
        <h3 className="text-sm font-black text-white">Wholesale lots</h3>
        {poolsLoading ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-500 mb-2" /> Loading lots…
          </div>
        ) : poolsError ? (
          <p className="text-xs text-rose-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {poolsError}
          </p>
        ) : pools.length === 0 ? (
          <p className="text-xs text-slate-400">No lots opened yet.</p>
        ) : (
          <div className="space-y-3">
            {pools.map((pool) => {
              const pct = pool.lotCapacity > 0 ? Math.min(100, Math.round((pool.pooledQuantity / pool.wholesaleMinimumQuantity) * 100)) : 0;
              return (
                <div key={pool.id} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">Lot #{pool.lotNumber}</span>
                    {pool.allOrdersDelivered ? (
                      <span className="px-2.5 py-0.5 rounded-full border border-emerald-700 bg-emerald-950/60 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                        Delivered
                      </span>
                    ) : (
                      <PoolStatusBadge status={pool.status} />
                    )}
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {pool.pooledQuantity} of {pool.wholesaleMinimumQuantity} minimum pooled ({pool.remainingQuantity} of{' '}
                    {pool.lotCapacity} lot capacity remaining) · {pool.participantCount} participant
                    {pool.participantCount === 1 ? '' : 's'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Deadline {formatDateTime(pool.deadline)}
                    {pool.completedAt && ` · Completed ${formatDateTime(pool.completedAt)}`}
                    {pool.closedAt && ` · Closed ${formatDateTime(pool.closedAt)}`}
                    {pool.closeReasonLabel && ` · ${pool.closeReasonLabel}`}
                  </p>
                  {pool.fulfilmentStatus && !pool.allOrdersDelivered && (
                    <p className="text-[10px] text-amber-300">
                      Fulfilment {pool.deliveredOrderCount} of {pool.orderCount} order
                      {pool.orderCount === 1 ? '' : 's'} delivered
                    </p>
                  )}
                  <LotOrdersDisclosure pool={pool} refreshKey={refreshKey} onChanged={onRefresh} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
