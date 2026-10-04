import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { formatDateTime, formatMoney } from '../../groupbuy/format';

const STATUSES = ['ALL', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const STATUS_CLASS = {
  DELIVERED: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  SHIPPED: 'bg-indigo-950 text-indigo-300 border-indigo-800',
  PROCESSING: 'bg-cyan-950 text-cyan-300 border-cyan-800',
  CANCELLED: 'bg-rose-950 text-rose-300 border-rose-800',
  PENDING: 'bg-amber-950 text-amber-300 border-amber-800',
};

// Group buy orders are paid and priced at settlement, so sellers only move them forward.
// Cancelling would restore product stock outside the campaign reservation, so it is not offered here.
const NEXT_STEP = {
  PENDING: { status: 'PROCESSING', label: 'Accept', className: 'bg-cyan-600 hover:bg-cyan-500' },
  PROCESSING: { status: 'SHIPPED', label: 'Dispatch', className: 'bg-indigo-600 hover:bg-indigo-500' },
  SHIPPED: { status: 'DELIVERED', label: 'Delivered', className: 'bg-emerald-600 hover:bg-emerald-500' },
};

export default function GroupBuyOrdersPanel({ orders, campaignTitleByGroupId = {}, updatingOrder, onStatusChange, emptyText }) {
  const [filter, setFilter] = useState('ALL');
  const visible = useMemo(
    () => (filter === 'ALL' ? orders : orders.filter((o) => o.status === filter)),
    [orders, filter]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs w-fit">
        {STATUSES.map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              filter === st ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {st === 'ALL' ? 'All' : st.charAt(0) + st.slice(1).toLowerCase()} (
            {st === 'ALL' ? orders.length : orders.filter((o) => o.status === st).length})
          </button>
        ))}
      </div>

      <div className="glass-card rounded-3xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 uppercase font-bold border-b border-slate-800">
              <tr>
                <th className="p-4">Order</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Items</th>
                <th className="p-4">Paid</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    {emptyText || 'No group buy orders for this filter.'}
                  </td>
                </tr>
              )}
              {visible.map((ord) => {
                const next = NEXT_STEP[ord.status];
                const campaignTitle = campaignTitleByGroupId[ord.groupBuyGroupId];
                return (
                  <tr key={ord.id} className="hover:bg-slate-900/40 align-top">
                    <td className="p-4">
                      <span className="font-bold text-white block">{ord.orderNumber}</span>
                      <span className="text-[10px] text-slate-500 block">{formatDateTime(ord.createdAt)}</span>
                      {campaignTitle && <span className="text-[10px] text-indigo-300 block truncate max-w-[180px]">{campaignTitle}</span>}
                    </td>
                    <td className="p-4">
                      <span className="font-semibold text-white block">{ord.userName || '—'}</span>
                      <span className="text-[10px] text-slate-400 block">
                        {[ord.shippingAddressLine1, ord.shippingCity].filter(Boolean).join(', ') || '—'}
                      </span>
                    </td>
                    <td className="p-4">
                      {(ord.items || []).map((item) => (
                        <span key={item.id} className="block">
                          {item.quantity} × {item.productName}
                          <span className="text-slate-500"> @ {formatMoney(item.unitPrice)}</span>
                        </span>
                      ))}
                    </td>
                    <td className="p-4">
                      <span className="font-extrabold text-white block">{formatMoney(ord.totalAmount)}</span>
                      {Number(ord.discountAmount) > 0 && (
                        <span className="text-[10px] text-emerald-400 block">
                          Group saving {formatMoney(ord.discountAmount)}
                        </span>
                      )}
                    </td>
                    <td className="p-4 space-y-1">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded border text-[10px] font-bold ${
                          STATUS_CLASS[ord.status] || STATUS_CLASS.PENDING
                        }`}
                      >
                        {ord.status}
                      </span>
                      {ord.paymentStatus && <span className="text-[10px] text-slate-500 block">Payment {ord.paymentStatus}</span>}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap space-x-2">
                      {ord.groupBuyGroupId && (
                        <Link
                          to={`/group-buy/groups/${ord.groupBuyGroupId}`}
                          title="View group"
                          className="inline-flex p-1.5 bg-slate-900 border border-slate-700 hover:border-indigo-500 text-indigo-300 rounded-lg"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      {next && (
                        <button
                          disabled={updatingOrder === ord.orderNumber}
                          onClick={() => onStatusChange(ord.orderNumber, next.status)}
                          className={`px-2.5 py-1 text-white rounded font-bold text-[11px] disabled:opacity-50 ${next.className}`}
                        >
                          {updatingOrder === ord.orderNumber ? '…' : next.label}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
