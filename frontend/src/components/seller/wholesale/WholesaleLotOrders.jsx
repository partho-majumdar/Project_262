import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Package, RefreshCw, TriangleAlert } from 'lucide-react';
import axiosClient from '../../../api/axiosClient';
import { apiErrorMessage } from '../../../api/groupBuyApi';
import { formatDateTime, formatMoney } from '../../groupbuy/format';

/**
 * The seller order state machine is PENDING -> PROCESSING -> SHIPPED -> DELIVERED. Only the
 * transitions the backend actually accepts are offered, so a click can never be rejected as an
 * invalid status change.
 */
const NEXT_STEP = {
  PENDING: { to: 'PROCESSING', label: 'Accept' },
  PROCESSING: { to: 'SHIPPED', label: 'Mark shipped' },
  SHIPPED: { to: 'DELIVERED', label: 'Mark delivered' },
};

const ORDER_STATUS_TONE = {
  PENDING: 'bg-slate-700/40 text-slate-300 border-slate-600',
  PROCESSING: 'bg-indigo-950/60 border-indigo-700 text-indigo-300',
  SHIPPED: 'bg-cyan-950/60 border-cyan-800 text-cyan-300',
  DELIVERED: 'bg-emerald-950/60 border-emerald-700 text-emerald-300',
  CANCELLED: 'bg-slate-900 border-slate-700 text-slate-400',
  REFUNDED: 'bg-rose-950/60 border-rose-800 text-rose-300',
};

/** The orders one wholesale lot produced, with the controls to fulfil them. */
export default function WholesaleLotOrders({ pool, refreshKey, onChanged }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyOrder, setBusyOrder] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosClient.get(`/seller/wholesale/pools/${pool.id}/orders`);
      setOrders(Array.isArray(data?.data) ? data.data : []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load this lot’s orders'));
    } finally {
      setLoading(false);
    }
  }, [pool.id]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const advance = async (order) => {
    const step = NEXT_STEP[order.status];
    if (!step) return;
    setBusyOrder(order.orderNumber);
    try {
      await axiosClient.put(`/seller/orders/${order.orderNumber}/status`, { status: step.to });
      setNotice(`${order.orderNumber} → ${step.to.toLowerCase()}`);
      setError('');
      await load();
      onChanged?.();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update this order'));
    } finally {
      setBusyOrder('');
    }
  };

  if (pool.orderCount === 0) {
    return (
      <p className="text-[10px] text-slate-500">
        No orders yet — this lot produced none, so there is nothing to fulfil.
      </p>
    );
  }

  return (
    <div className="pt-2 mt-2 border-t border-slate-800 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          Orders in this lot ({pool.deliveredOrderCount}/{pool.orderCount} delivered)
        </p>
        <button type="button" onClick={load} className="text-[10px] text-slate-400 hover:text-white font-bold flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {notice && <p className="text-[10px] text-emerald-300">{notice}</p>}
      {error && <p className="text-[10px] text-rose-300 flex items-center gap-1"><TriangleAlert className="w-3 h-3" /> {error}</p>}

      {loading ? (
        <p className="text-[10px] text-slate-500 py-2">Loading orders…</p>
      ) : (
        <ul className="space-y-1.5">
          {orders.map((order) => {
            const step = NEXT_STEP[order.status];
            return (
              <li
                key={order.orderNumber}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="text-[11px] font-bold text-white">{order.orderNumber}</span>
                    <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase ${ORDER_STATUS_TONE[order.status] ?? ORDER_STATUS_TONE.PENDING}`}>
                      {order.status?.toLowerCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {order.customerName ?? 'Customer'} · {order.totalAmount != null ? formatMoney(order.totalAmount) : '—'} ·{' '}
                    placed {formatDateTime(order.createdAt)}
                  </p>
                </div>
                {step && (
                  <button
                    type="button"
                    onClick={() => advance(order)}
                    disabled={busyOrder === order.orderNumber}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[10px] font-bold"
                  >
                    {busyOrder === order.orderNumber ? 'Saving…' : step.label}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Small disclosure so the seller can open a lot's orders without a page change. */
export function LotOrdersDisclosure({ pool, refreshKey, onChanged }) {
  const [open, setOpen] = useState(false);
  if (pool.orderCount === 0) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] font-bold text-indigo-300 hover:text-indigo-200 flex items-center gap-1"
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {open ? 'Hide orders' : `View ${pool.orderCount} order${pool.orderCount === 1 ? '' : 's'} in this lot`}
      </button>
      {open && <WholesaleLotOrders pool={pool} refreshKey={refreshKey} onChanged={onChanged} />}
    </div>
  );
}
