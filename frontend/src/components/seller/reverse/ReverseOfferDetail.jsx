import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Edit3,
  Package,
  PackageCheck,
  RefreshCw,
  Target,
  Truck,
  XCircle,
  Zap,
} from 'lucide-react';
import { sellerReverseGroupBuyingApi } from '../../../api/reverseGroupBuyingApi';
import { apiErrorMessage } from '../../../api/groupBuyApi';
import { formatDateTime, formatMoney } from '../../groupbuy/format';
import ReverseTargetProgress from '../../reverse/ReverseTargetProgress';
import { RgbParticipationBadge, RgbStatusBadge } from '../../reverse/RgbStatusBadge';
import {
  canActivateRgbOffer,
  canCloseRgbOffer,
  canCompleteRgbOffer,
  canEditRgbOffer,
  canStartRgbFulfillment,
  describeRgbTarget,
} from '../../reverse/reverseMeta';

export default function ReverseOfferDetail({ offer, busy, refreshKey, onBack, onEdit, onAction }) {
  const [participations, setParticipations] = useState([]);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError('');
    sellerReverseGroupBuyingApi
      .getParticipations(offer.id)
      .then((list) => !ignore && setParticipations(Array.isArray(list) ? list : []))
      .catch((err) => !ignore && setError(apiErrorMessage(err, 'Could not load customer demand')))
      .finally(() => !ignore && setLoading(false));

    if (offer.targetReached) {
      sellerReverseGroupBuyingApi
        .getCampaign(offer.id)
        .then((data) => !ignore && setCampaign(data))
        .catch(() => !ignore && setCampaign(null));
    } else {
      setCampaign(null);
    }
    return () => {
      ignore = true;
    };
  }, [offer.id, offer.targetReached, refreshKey]);

  const actionButton = 'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50';

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 font-bold">
        <ArrowLeft className="w-4 h-4" /> Back to reverse offers
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
            <RgbStatusBadge status={offer.status} />
            <span className="text-[10px] text-slate-500">Created {formatDateTime(offer.createdAt)}</span>
          </div>
          <h2 className="text-xl font-black text-white">{offer.productName}</h2>
          <p className="text-xs font-bold text-cyan-300">{describeRgbTarget(offer)}</p>
          <p className="text-xs text-slate-400">
            {formatMoney(offer.productPrice)} regular →{' '}
            <strong className="text-emerald-300">{formatMoney(offer.unlockedUnitPrice)}</strong> unlocked ·{' '}
            {offer.targetTypeLabel || offer.targetType}
          </p>
          <p className="text-[11px] text-slate-500">
            {offer.minQuantityPerCustomer}–{offer.maxQuantityPerCustomer} units per customer · deadline{' '}
            {formatDateTime(offer.participationDeadline)} · {offer.availableQuantity} units available
          </p>
        </div>
        <div className="flex flex-wrap md:flex-col gap-2 md:items-stretch">
          {canEditRgbOffer(offer.status) && (
            <button
              onClick={() => onEdit(offer)}
              disabled={busy}
              className={`${actionButton} bg-slate-900 border border-slate-700 hover:border-cyan-500 text-slate-100`}
            >
              <Edit3 className="w-4 h-4" /> Edit
            </button>
          )}
          {canActivateRgbOffer(offer.status) && (
            <button
              onClick={() => onAction('activate', offer)}
              disabled={busy}
              className={`${actionButton} bg-cyan-600 hover:bg-cyan-500 text-white`}
            >
              <Zap className="w-4 h-4" /> Activate offer
            </button>
          )}
          {canStartRgbFulfillment(offer.status) && (
            <button
              onClick={() => onAction('fulfillment', offer)}
              disabled={busy}
              className={`${actionButton} bg-indigo-600 hover:bg-indigo-500 text-white`}
            >
              <Truck className="w-4 h-4" /> Start fulfillment
            </button>
          )}
          {canCompleteRgbOffer(offer.status) && (
            <button
              onClick={() => onAction('complete', offer)}
              disabled={busy}
              className={`${actionButton} bg-emerald-600 hover:bg-emerald-500 text-white`}
            >
              <PackageCheck className="w-4 h-4" /> Mark completed
            </button>
          )}
          {canCloseRgbOffer(offer.status) && (
            <button
              onClick={() => setCloseOpen((v) => !v)}
              disabled={busy}
              className={`${actionButton} bg-slate-900 border border-rose-800 hover:bg-rose-950 text-rose-300`}
            >
              <XCircle className="w-4 h-4" /> Close offer
            </button>
          )}
        </div>
      </div>

      {closeOpen && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800 space-y-3 text-xs">
          <p className="font-bold text-rose-200">
            Closing refunds every active commitment and releases the reserved inventory. This can't be undone.
          </p>
          <textarea
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            placeholder="Reason (optional)"
            rows={2}
            className="w-full bg-slate-900 border border-rose-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                onAction('close', offer, closeReason.trim());
                setCloseOpen(false);
                setCloseReason('');
              }}
              disabled={busy}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold"
            >
              Confirm close
            </button>
            <button
              onClick={() => setCloseOpen(false)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-bold"
            >
              Never mind
            </button>
          </div>
        </div>
      )}

      <div className="glass-card rounded-3xl border border-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white flex items-center gap-1.5">
            <Target className="w-4 h-4 text-cyan-400" /> Collective demand
          </h3>
          <span className="text-[11px] text-slate-400">
            {offer.participantCount} customer{offer.participantCount === 1 ? '' : 's'}
          </span>
        </div>
        <ReverseTargetProgress currentDemand={offer.currentDemand} targetQuantity={offer.targetQuantity} />

        {campaign && (
          <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/60 space-y-1.5 text-xs">
            <p className="font-bold text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Purchase confirmed
            </p>
            <p className="text-slate-300">
              {campaign.totalConfirmedQuantity} units at {formatMoney(campaign.unlockedUnitPrice)} per unit across{' '}
              {campaign.participantCount} customers. Each keeps an individual order.
            </p>
            <p className="text-[10px] text-slate-500">Activated {formatDateTime(campaign.activatedAt)}</p>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-cyan-500 mb-2" /> Loading demand…
          </div>
        ) : error ? (
          <p className="text-xs text-rose-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {error}
          </p>
        ) : participations.length === 0 ? (
          <p className="text-xs text-slate-400">No customer has committed demand to this offer yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 uppercase font-bold">
                <tr>
                  <th className="p-3">Committed</th>
                  <th className="p-3">Quantity</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {participations.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-900/40">
                    <td className="p-3 text-slate-400">{formatDateTime(p.participatedAt)}</td>
                    <td className="p-3 font-mono">{p.quantity}</td>
                    <td className="p-3">
                      <span className="font-bold text-white">{formatMoney(p.totalAmount)}</span>
                      <span className="block text-[10px] text-slate-500">@ {formatMoney(p.unitPrice)}</span>
                    </td>
                    <td className="p-3">
                      <RgbParticipationBadge status={p.status} />
                    </td>
                    <td className="p-3 text-slate-400">
                      {p.orderNumber ? `${p.orderNumber} · ${p.orderStatus}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
