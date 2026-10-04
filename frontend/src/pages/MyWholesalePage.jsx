import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  Loader2,
  MessageSquareWarning,
  Truck,
  Package,
  RefreshCcw,
  Ticket,
  XCircle,
} from 'lucide-react';
import { wholesaleApi } from '../api/wholesaleApi';
import { apiErrorMessage } from '../api/groupBuyApi';
import useLiveReload, { topics } from '../components/groupbuy/useLiveReload';
import { formatDateTime, formatMoney } from '../components/groupbuy/format';
import WholesalePoolProgress from '../components/wholesale/WholesalePoolProgress';
import WholesaleDisputeModal from '../components/wholesale/WholesaleDisputeModal';

const TABS = [
  { id: 'active', label: 'Active reservations', statuses: ['RESERVED'] },
  { id: 'completed', label: 'Completed purchases', statuses: ['CONVERTED'] },
  { id: 'failed', label: 'Failed purchases', statuses: ['REFUNDED'] },
  { id: 'cancelled', label: 'Cancelled', statuses: ['CANCELLED'] },
  { id: 'all', label: 'All history', statuses: null },
];

export default function MyWholesalePage() {
  const [tab, setTab] = useState('active');
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [disputeTarget, setDisputeTarget] = useState(null);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await wholesaleApi.getMyReservations();
      setReservations(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your wholesale reservations.'));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  useLiveReload([topics.WHOLESALE], () => load(false));

  const visible = useMemo(() => {
    const statuses = TABS.find((t) => t.id === tab)?.statuses;
    return statuses ? reservations.filter((r) => statuses.includes(r.status)) : reservations;
  }, [reservations, tab]);

  const handleCancel = async (reservation) => {
    setBusyId(reservation.id);
    setError('');
    try {
      await wholesaleApi.cancelReservation(reservation.id);
      setNotice('Reservation cancelled and refunded.');
      await load(false);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not cancel this reservation.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Ticket className="w-7 h-7 text-indigo-400" /> My wholesale reservations
          </h1>
          <p className="text-xs text-slate-400">Track your reservations, completed orders and refunds.</p>
        </div>
        <Link to="/wholesale" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold">
          Browse wholesale pools
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        {TABS.map((t) => {
          const n = t.statuses ? reservations.filter((r) => t.statuses.includes(r.status)).length : reservations.length;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-full border font-bold transition ${
                tab === t.id
                  ? 'bg-indigo-600 border-indigo-500 text-white'
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
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="glass-card p-10 rounded-3xl border border-slate-800 text-center space-y-2">
          <Boxes className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-300">Nothing here yet</p>
          <p className="text-xs text-slate-500">Reserve quantity in an open wholesale pool to see it here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <ReservationCard
              key={r.id}
              reservation={r}
              busy={busyId === r.id}
              onCancel={() => handleCancel(r)}
              onReport={() => setDisputeTarget(r)}
            />
          ))}
        </div>
      )}

      <WholesaleDisputeModal
        isOpen={!!disputeTarget}
        reservation={disputeTarget}
        onClose={() => setDisputeTarget(null)}
        onSuccess={() => {
          setDisputeTarget(null);
          setNotice('Your report was submitted. We\'ll notify you when it\'s reviewed.');
        }}
      />
    </div>
  );
}

const STATUS_META = {
  RESERVED: { label: 'Reserved', className: 'bg-emerald-950/60 border-emerald-700 text-emerald-300', icon: CheckCircle2 },
  CONVERTED: { label: 'Order placed', className: 'bg-indigo-950/60 border-indigo-700 text-indigo-300', icon: Package },
  REFUNDED: { label: 'Refunded', className: 'bg-rose-950/60 border-rose-800 text-rose-300', icon: RefreshCcw },
  CANCELLED: { label: 'Cancelled', className: 'bg-slate-900 border-slate-700 text-slate-400', icon: XCircle },
};

/** A reservation is a flat CONVERTED once its order exists, so delivery progress comes from the order. */
const ORDER_STATUS_META = {
  PENDING: { label: 'Awaiting confirmation', className: 'bg-indigo-950/60 border-indigo-700 text-indigo-300' },
  CONFIRMED: { label: 'Confirmed', className: 'bg-indigo-950/60 border-indigo-700 text-indigo-300' },
  PROCESSING: { label: 'Processing', className: 'bg-cyan-950/60 border-cyan-800 text-cyan-300' },
  SHIPPED: { label: 'Shipped', className: 'bg-cyan-950/60 border-cyan-800 text-cyan-300' },
  DELIVERED: { label: 'Delivered', className: 'bg-emerald-950/60 border-emerald-700 text-emerald-300' },
  CANCELLED: { label: 'Order cancelled', className: 'bg-slate-900 border-slate-700 text-slate-400' },
  REFUNDED: { label: 'Refunded', className: 'bg-rose-950/60 border-rose-800 text-rose-300' },
};

function ReservationCard({ reservation: r, busy, onCancel, onReport }) {
  // Once a reservation has become an order, the reservation status stops changing, so the order
  // status is what tells the customer whether the goods have actually arrived.
  const orderMeta = r.status === 'CONVERTED' ? ORDER_STATUS_META[r.orderStatus] : null;
  const meta = orderMeta
    ? { ...STATUS_META.CONVERTED, className: orderMeta.className, label: orderMeta.label }
    : STATUS_META[r.status] || STATUS_META.CANCELLED;
  const Icon = meta.icon;

  return (
    <div className="glass-card p-4 rounded-3xl border border-slate-800 flex flex-col sm:flex-row gap-4">
      <div className="w-16 h-16 rounded-xl bg-slate-800 overflow-hidden shrink-0 border border-slate-700 flex items-center justify-center">
        {r.productImageUrl ? (
          <img src={r.productImageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <Package className="w-6 h-6 text-slate-500" />
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1.5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-white truncate">{r.productName}</span>
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${meta.className}`}>
            <Icon className="w-3 h-3" /> {meta.label}
          </span>
        </div>
        <p className="text-slate-400">
          {r.quantity} unit(s) × {formatMoney(r.unitPriceAtReservation)} ={' '}
          <span className="text-white font-bold">{formatMoney(r.totalAmount)}</span>
        </p>

        {r.status === 'RESERVED' && (
          <>
            <WholesalePoolProgress pooledQuantity={r.poolPooledQuantity} wholesaleMinimumQuantity={r.poolCapacity} compact />
            <p className="text-[10px] text-slate-500">Deadline {formatDateTime(r.poolDeadline)}</p>
          </>
        )}

        {r.status === 'CONVERTED' && (
          <p className="text-[10px] text-slate-500">
            Order {r.orderNumber} · {r.paymentStatus?.toLowerCase()}
          </p>
        )}

        {r.status === 'REFUNDED' && (
          <p className="text-[10px] text-rose-300">Refunded {formatMoney(r.refundAmount)}: pool did not reach its minimum in time.</p>
        )}

        {r.status === 'CANCELLED' && (
          <p className="text-[10px] text-slate-500">Refunded {formatMoney(r.refundAmount)} on {formatDateTime(r.cancelledAt)}.</p>
        )}
      </div>

      <div className="flex sm:flex-col gap-2 sm:items-end justify-center shrink-0">
        {r.status === 'RESERVED' && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 rounded-xl border border-rose-800 text-rose-300 hover:bg-rose-950 text-xs font-bold disabled:opacity-50"
          >
            {busy ? 'Cancelling…' : 'Cancel reservation'}
          </button>
        )}
        {r.status === 'CONVERTED' && (
          <>
            <Link
              to={`/orders/tracking?order=${encodeURIComponent(r.orderNumber)}`}
              className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5"
            >
              <Truck className="w-3.5 h-3.5" /> Track order
            </Link>
            <button
              type="button"
              onClick={onReport}
              className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5"
            >
              <MessageSquareWarning className="w-3.5 h-3.5" /> Report a problem
            </button>
          </>
        )}
      </div>
    </div>
  );
}
