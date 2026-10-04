import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Package,
  RefreshCcw,
  Target,
  Ticket,
  XCircle,
} from 'lucide-react';
import { reverseGroupBuyingApi } from '../api/reverseGroupBuyingApi';
import { apiErrorMessage } from '../api/groupBuyApi';
import useLiveReload, { topics } from '../components/groupbuy/useLiveReload';
import { formatDateTime, formatMoney } from '../components/groupbuy/format';
import ReverseTargetProgress from '../components/reverse/ReverseTargetProgress';
import { RgbParticipationBadge } from '../components/reverse/RgbStatusBadge';

const TABS = [
  { id: 'active', label: 'Counting toward the target', statuses: ['PARTICIPATING'] },
  { id: 'completed', label: 'Order created', statuses: ['CONVERTED'] },
  { id: 'ended', label: 'Refunded / withdrawn', statuses: ['REFUNDED', 'CANCELLED'] },
  { id: 'all', label: 'All history', statuses: null },
];

export default function MyReverseDemandPage() {
  const [tab, setTab] = useState('active');
  const [participations, setParticipations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await reverseGroupBuyingApi.getMyParticipations();
      setParticipations(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your demand.'));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  useLiveReload([topics.REVERSE_GROUP_BUYING], () => load(false));

  const visible = useMemo(() => {
    const statuses = TABS.find((t) => t.id === tab)?.statuses;
    return statuses ? participations.filter((p) => statuses.includes(p.status)) : participations;
  }, [participations, tab]);

  const handleCancel = async (participation) => {
    setBusyId(participation.id);
    setError('');
    setNotice('');
    try {
      await reverseGroupBuyingApi.cancelParticipation(participation.id);
      setNotice('Your demand was withdrawn and refunded in full.');
      await load(false);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not withdraw your demand.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Ticket className="w-7 h-7 text-cyan-400" /> My demand
          </h1>
          <p className="text-xs text-slate-400">
            Demand you have committed to reverse group buying offers, and the orders it turned into.
          </p>
        </div>
        <Link
          to="/reverse-group-buying"
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold"
        >
          Browse offers
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        {TABS.map((t) => {
          const n = t.statuses ? participations.filter((p) => t.statuses.includes(p.status)).length : participations.length;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-full border font-bold transition ${
                tab === t.id
                  ? 'bg-cyan-600 border-cyan-500 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {t.label} ({n})
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {notice && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-800 rounded-2xl text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {notice}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="glass-card p-10 rounded-3xl border border-slate-800 text-center space-y-2">
          <Target className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-300">Nothing here yet</p>
          <p className="text-xs text-slate-500">Commit demand to an open offer to see it here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((p) => (
            <ParticipationCard
              key={p.id}
              participation={p}
              busy={busyId === p.id}
              onCancel={() => handleCancel(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ParticipationCard({ participation: p, busy, onCancel }) {
  return (
    <div className="glass-card p-4 rounded-3xl border border-slate-800 flex flex-col sm:flex-row gap-4">
      <div className="w-16 h-16 rounded-xl bg-slate-800 overflow-hidden shrink-0 border border-slate-700 flex items-center justify-center">
        {p.productImageUrl ? (
          <img src={p.productImageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <Package className="w-6 h-6 text-slate-500" />
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1.5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-white truncate">{p.productName}</span>
          <RgbParticipationBadge status={p.status} />
        </div>
        <p className="text-slate-400">
          {p.quantity} unit(s) × {formatMoney(p.unitPrice)} ={' '}
          <span className="text-white font-bold">{formatMoney(p.totalAmount)}</span>
        </p>

        {p.status === 'PARTICIPATING' && (
          <>
            <ReverseTargetProgress
              currentDemand={p.offerCurrentDemand}
              targetQuantity={p.offerTargetQuantity}
              compact
            />
            <p className="text-[10px] text-slate-500">
              Demand closes {formatDateTime(p.offerDeadline)} · {p.offerParticipantCount} customers
            </p>
          </>
        )}

        {p.status === 'CONVERTED' && (
          <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
            <Package className="w-3 h-3" /> Order {p.orderNumber} · {p.orderStatus} ·{' '}
            {String(p.orderPaymentStatus || '').toLowerCase()}
          </p>
        )}

        {p.status === 'REFUNDED' && (
          <p className="text-[10px] text-rose-300 flex items-center gap-1.5">
            <RefreshCcw className="w-3 h-3" /> Refunded {formatMoney(p.refundAmount)}: the target was not met.
          </p>
        )}

        {p.status === 'CANCELLED' && (
          <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
            <XCircle className="w-3 h-3" /> Withdrawn {formatDateTime(p.cancelledAt)} · refunded{' '}
            {formatMoney(p.refundAmount)}
          </p>
        )}
      </div>

      <div className="flex sm:flex-col gap-2 sm:items-end justify-center shrink-0">
        {p.status === 'PARTICIPATING' && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 rounded-xl border border-rose-800 text-rose-300 hover:bg-rose-950 text-xs font-bold disabled:opacity-50"
          >
            {busy ? 'Withdrawing…' : 'Withdraw demand'}
          </button>
        )}
        {p.orderNumber && (
          <Link
            to="/orders"
            className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold text-center"
          >
            View order
          </Link>
        )}
      </div>
    </div>
  );
}
