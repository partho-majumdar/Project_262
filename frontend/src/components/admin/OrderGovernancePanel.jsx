import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Loader2, Search, Undo2, X } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import { apiErrorMessage } from '../../api/groupBuyApi';
import { formatDateTime, formatMoney } from '../groupbuy/format';

const STATUS_TONES = {
  DELIVERED: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  SHIPPED: 'bg-cyan-950 text-cyan-300 border-cyan-800',
  PROCESSING: 'bg-indigo-950 text-indigo-300 border-indigo-800',
  PENDING: 'bg-amber-950 text-amber-300 border-amber-800',
  CANCELLED: 'bg-slate-900 text-slate-400 border-slate-700',
  REFUNDED: 'bg-rose-950 text-rose-300 border-rose-800',
};

const STATUS_FILTERS = ['ALL', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
const TYPE_FILTERS = [
  { id: 'ALL', label: 'All types' },
  { id: 'STANDARD', label: 'Standard' },
  { id: 'GROUP_BUY', label: 'Group buy' },
];

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Opens the order as a printable invoice; the browser's print dialog handles "save as PDF". */
const printInvoice = (order) => {
  const win = window.open('', '_blank', 'width=760,height=900');
  if (!win) return;
  const itemRows = (order.items || [])
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.productName)}<div class="muted">${escapeHtml(item.sellerStoreName || '')}</div></td>` +
        `<td class="num">${item.quantity}</td><td class="num">${escapeHtml(formatMoney(item.unitPrice))}</td>` +
        `<td class="num">${escapeHtml(formatMoney(item.subtotal))}</td></tr>`,
    )
    .join('');
  const totals = [
    ['Subtotal', order.subtotalAmount],
    ['Discount', order.discountAmount],
    ['Tax', order.taxAmount],
    ['Shipping', order.shippingAmount],
    ['Total', order.totalAmount],
  ]
    .filter(([label, value]) => label === 'Total' || Number(value) > 0)
    .map(
      ([label, value]) =>
        `<tr class="${label === 'Total' ? 'grand' : ''}"><td colspan="3">${label}</td><td class="num">${escapeHtml(formatMoney(value))}</td></tr>`,
    )
    .join('');
  const address = [order.shippingAddressLine1, order.shippingAddressLine2, order.shippingCity, order.shippingState,
    order.shippingPostalCode, order.shippingCountry].filter(Boolean).join(', ');

  win.document.write(`<!doctype html><html><head><title>Invoice ${escapeHtml(order.orderNumber)}</title>
    <style>
      body { font-family: system-ui, sans-serif; color: #0f172a; padding: 40px; }
      h1 { margin: 0 0 4px; font-size: 22px; }
      .muted { color: #64748b; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 13px; }
      th { text-align: left; color: #64748b; font-weight: 600; border-bottom: 1px solid #cbd5e1; padding: 6px 0; }
      td { padding: 8px 0; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
      .num { text-align: right; white-space: nowrap; }
      .grand td { font-weight: 700; font-size: 15px; border-bottom: none; }
    </style></head><body>
    <h1>GroupMart Invoice</h1>
    <div class="muted">${escapeHtml(order.orderNumber)} · ${escapeHtml(formatDateTime(order.createdAt))}</div>
    <div class="muted">Billed to ${escapeHtml(order.userName || '')} (${escapeHtml(order.userEmail || '')})</div>
    <div class="muted">Ship to ${escapeHtml(address)}</div>
    <table>
      <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Amount</th></tr></thead>
      <tbody>${itemRows}${totals}</tbody>
    </table>
    <p class="muted">Payment: ${escapeHtml(order.paymentMethod || '')} · ${escapeHtml(order.paymentStatus || '')} ·
      Order status: ${escapeHtml(order.status || '')}</p>
    <p class="muted">Sandbox transaction. Amounts in Bangladeshi Taka.</p>
    </body></html>`);
  win.document.close();
  win.focus();
  win.print();
};

/**
 * Admin order registry: search, filter, refund and invoice.
 * Order status itself stays with the seller, so this panel never moves an order along.
 */
export default function OrderGovernancePanel({ orders, onOrderUpdated }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [refunding, setRefunding] = useState(null); // { orderNumber, amount, reason }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (orders || []).filter((o) => {
      if (status !== 'ALL' && o.status !== status) return false;
      if (type !== 'ALL' && (o.orderType || 'STANDARD') !== type) return false;
      if (!needle) return true;
      return [o.orderNumber, o.userName, o.userEmail].some((v) => v?.toLowerCase().includes(needle));
    });
  }, [orders, search, status, type]);

  const submitRefund = async () => {
    const amount = refunding.amount.trim();
    if (!refunding.reason.trim()) {
      setError('Give a reason — the customer sees it.');
      return;
    }
    if (amount && !(Number(amount) > 0)) {
      setError('Enter an amount above zero, or leave it blank to refund everything still paid.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await axiosClient.post(`/admin/orders/${refunding.orderNumber}/refund`, {
        amount: amount ? Number(amount) : null,
        reason: refunding.reason.trim(),
      });
      const updated = res?.data;
      if (updated) onOrderUpdated?.(updated);
      setNotice(`Refunded ${amount ? formatMoney(amount) : 'the full remaining amount'} on ${refunding.orderNumber}. The customer was notified.`);
      setRefunding(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not issue the refund'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <h3 className="text-xs font-black uppercase text-rose-400 tracking-wider">Order Registry & Invoicing</h3>
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Order number, customer name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 pl-9 text-xs text-slate-100"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`px-2.5 py-1 rounded-full border font-bold transition ${
              status === s ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {s === 'ALL' ? 'All statuses' : s}
          </button>
        ))}
        <span className="w-px h-5 bg-slate-800 mx-1" />
        {TYPE_FILTERS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setType(t.id)}
            className={`px-2.5 py-1 rounded-full border font-bold transition ${
              type === t.id ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto text-slate-500">{visible.length} of {(orders || []).length} orders</span>
      </div>

      {(error || notice) && (
        <div
          className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
            error ? 'bg-rose-950/50 border-rose-800 text-rose-200' : 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
          }`}
        >
          <span className="flex items-center gap-2">
            {error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {error || notice}
          </span>
          <button
            type="button"
            onClick={() => {
              setError('');
              setNotice('');
            }}
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="overflow-x-auto text-xs">
        <table className="w-full text-left text-slate-300">
          <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Type</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3">Payment</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {visible.map((o) => {
              const isRefunding = refunding?.orderNumber === o.orderNumber;
              const refundable = o.paymentStatus === 'COMPLETED';
              return (
                <React.Fragment key={o.id || o.orderNumber}>
                  <tr className="hover:bg-slate-900/40 align-top">
                    <td className="p-3">
                      <span className="font-bold text-white block">{o.orderNumber}</span>
                      <span className="text-[10px] text-slate-500">{formatDateTime(o.createdAt)}</span>
                    </td>
                    <td className="p-3">
                      <span className="block text-slate-200">{o.userName || '—'}</span>
                      <span className="text-[10px] text-slate-500">{o.userEmail}</span>
                    </td>
                    <td className="p-3 text-slate-400">{o.orderType === 'GROUP_BUY' ? 'Group buy' : 'Standard'}</td>
                    <td className="p-3 text-right font-bold font-mono text-white">{formatMoney(o.totalAmount)}</td>
                    <td className="p-3 text-slate-400">
                      {o.paymentStatus}
                      <span className="block text-[10px] text-slate-500">{(o.paymentMethod || '').replace(/_/g, ' ')}</span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded border text-[9px] font-bold ${
                          STATUS_TONES[o.status] || STATUS_TONES.PENDING
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={!refundable}
                        title={refundable ? 'Refund this order' : 'Only a paid order can be refunded'}
                        onClick={() => {
                          setError('');
                          setNotice('');
                          setRefunding({ orderNumber: o.orderNumber, amount: '', reason: '' });
                        }}
                        className="px-2 py-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 text-white rounded text-[10px] font-bold inline-flex items-center gap-1"
                      >
                        <Undo2 className="w-3 h-3" /> Refund
                      </button>
                      <button
                        type="button"
                        onClick={() => printInvoice(o)}
                        className="p-1.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded"
                        title="Print or save the invoice"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                  {isRefunding && (
                    <tr className="bg-slate-950/80">
                      <td colSpan={7} className="p-4">
                        <div className="space-y-3 max-w-2xl">
                          <p className="text-slate-300">
                            Refunding <strong className="text-white">{o.orderNumber}</strong> ({formatMoney(o.totalAmount)} paid by{' '}
                            {(o.paymentMethod || '').replace(/_/g, ' ')}). Leave the amount blank to refund everything the
                            customer still has paid. The customer is notified and the refund appears in the order's payment history.
                          </p>
                          <div className="flex flex-wrap gap-2 items-start">
                            <label className="space-y-1">
                              <span className="text-[11px] text-slate-400 font-semibold block">Amount (৳)</span>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={refunding.amount}
                                onChange={(e) => setRefunding((prev) => ({ ...prev, amount: e.target.value }))}
                                placeholder="Full remaining"
                                className="w-36 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
                              />
                            </label>
                            <label className="space-y-1 flex-1 min-w-[16rem]">
                              <span className="text-[11px] text-slate-400 font-semibold block">
                                Reason <span className="text-rose-400">(required, shown to the customer)</span>
                              </span>
                              <input
                                type="text"
                                maxLength={300}
                                value={refunding.reason}
                                onChange={(e) => setRefunding((prev) => ({ ...prev, reason: e.target.value }))}
                                placeholder="e.g. Item arrived damaged"
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
                              />
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={submitRefund}
                              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
                            >
                              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Issue refund
                            </button>
                            <button
                              type="button"
                              onClick={() => setRefunding(null)}
                              className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 font-bold"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-slate-500 font-medium">
                  {(orders || []).length === 0 ? 'No orders yet.' : 'No orders match these filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
