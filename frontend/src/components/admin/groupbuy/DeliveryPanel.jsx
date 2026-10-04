import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, RefreshCw, RotateCcw, Save, Truck, X } from 'lucide-react';
import { adminGroupBuyApi, apiErrorMessage } from '../../../api/groupBuyApi';
import { formatDateTime, formatMoney } from '../../groupbuy/format';
import { Banner, EmptyState, FilterChips, Loading, Panel, listOf, rowClass, tableClass, theadClass } from './adminUi';

const ORDER_TYPE_LABELS = {
  STANDARD: 'Standard',
  GROUP_BUY: 'Group buy',
  WHOLESALE: 'Wholesale',
  REVERSE_GROUP_BUYING: 'Reverse group buying',
  GROUP_REVERSE_BUYING: 'Customer lead group buying',
  AUCTION: 'Auction',
  GROUP_BUYING_AUCTION: 'Group buying auction',
};

const SCOPES = [
  { id: 'GROUP_BUY', label: 'Group buy orders' },
  { id: 'WHOLESALE', label: 'Wholesale orders' },
  { id: 'REVERSE_GROUP_BUYING', label: 'Reverse group buying orders' },
  { id: 'GROUP_REVERSE_BUYING', label: 'Customer lead group buying orders' },
  { id: 'AUCTION', label: 'Auction orders' },
  { id: 'GROUP_BUYING_AUCTION', label: 'Group buying auction orders' },
  { id: 'ALL', label: 'All orders' },
];

const STATUSES = [
  { id: 'OPEN', label: 'On the way' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'PROCESSING', label: 'Confirmed' },
  { id: 'SHIPPED', label: 'Shipped' },
  { id: 'ALL', label: 'All' },
];

const RULE_FIELDS = [
  { key: 'standardDays', label: 'Standard ground', hint: 'days after the order is placed' },
  { key: 'expressDays', label: 'Priority express', hint: 'days' },
  { key: 'overnightDays', label: 'Overnight courier', hint: 'days' },
  { key: 'groupBuyExtraDays', label: 'Group buy extra', hint: 'added days, because the group settles first' },
  { key: 'cutoffHour', label: 'Arrives by (hour)', hint: '0–23, e.g. 17 shows “by 5:00 PM”' },
];

/** `datetime-local` value in the browser's own time. */
const toLocalInput = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function DeliveryPanel({
  initialScope = 'GROUP_BUY',
  scopeOptions = SCOPES,
  showSettings = true,
}) {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(null);
  const [recalculate, setRecalculate] = useState(true);
  const [savingRule, setSavingRule] = useState(false);

  const [scope, setScope] = useState(initialScope);
  const [status, setStatus] = useState('OPEN');
  const [query, setQuery] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null); // { orderNumber, date, note }
  const [busyOrder, setBusyOrder] = useState(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      setOrders(listOf(await adminGroupBuyApi.getDeliveryOrders({ scope, status, q: query || undefined })));
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load orders'));
    } finally {
      setLoading(false);
    }
  }, [scope, status, query]);

  useEffect(() => {
    adminGroupBuyApi
      .getDeliverySettings()
      .then((data) => {
        setSettings(data);
        setForm(data);
      })
      .catch((err) => setError(apiErrorMessage(err, 'Could not load the delivery rule')));
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const saveRule = async () => {
    setSavingRule(true);
    setError('');
    setNotice('');
    try {
      const saved = await adminGroupBuyApi.updateDeliverySettings({ ...form, recalculateExisting: recalculate });
      setSettings(saved);
      setForm(saved);
      setNotice(
        saved.recalculatedOrders
          ? `Rule saved. ${saved.recalculatedOrders} order(s) still on the automatic date were moved.`
          : 'Rule saved. It applies to new orders from now on.',
      );
      await loadOrders();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save the rule'));
    } finally {
      setSavingRule(false);
    }
  };

  const saveOrder = async (orderNumber, payload, message) => {
    setBusyOrder(orderNumber);
    setError('');
    setNotice('');
    try {
      const saved = await adminGroupBuyApi.updateEstimatedDelivery(orderNumber, payload);
      setOrders((prev) => prev.map((o) => (o.orderNumber === orderNumber ? { ...o, ...saved } : o)));
      setEditing(null);
      setNotice(message);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update the delivery date'));
    } finally {
      setBusyOrder(null);
    }
  };

  if (!form) return <Loading label="Loading delivery settings…" />;

  return (
    <div className="space-y-5 text-xs">
      <Banner
        error={error}
        notice={notice}
        onClear={() => {
          setError('');
          setNotice('');
        }}
      />

      {showSettings && (
      <Panel
        title="Delivery estimate rule"
        icon={Truck}
        actions={
          <button
            type="button"
            onClick={saveRule}
            disabled={savingRule}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            {savingRule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save rule
          </button>
        }
      >
        <p className="text-slate-400">
          This fills in the “Estimated delivery” date shoppers see on order tracking. The count starts when the order is
          placed and restarts from the day the seller ships it.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {RULE_FIELDS.map((field) => (
            <label key={field.key} className="block space-y-1">
              <span className="text-slate-300 font-semibold block">{field.label}</span>
              <input
                type="number"
                min={0}
                max={field.key === 'cutoffHour' ? 23 : 90}
                value={form[field.key] ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value === '' ? '' : Number(e.target.value) }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
              />
              <span className="text-[10px] text-slate-500 block">{field.hint}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4 pt-1">
          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(form.skipWeekends)}
              onChange={(e) => setForm((prev) => ({ ...prev, skipWeekends: e.target.checked }))}
              className="accent-rose-500"
            />
            Skip weekends (Friday and Saturday are not counted)
          </label>
          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={recalculate}
              onChange={(e) => setRecalculate(e.target.checked)}
              className="accent-rose-500"
            />
            Also move orders that are still on the automatic date
          </label>
        </div>
        {settings && (
          <p className="text-[11px] text-slate-500">
            Now in use: standard {settings.standardDays}d · express {settings.expressDays}d · overnight{' '}
            {settings.overnightDays}d · group buy +{settings.groupBuyExtraDays}d · arrives by {settings.cutoffHour}:00 ·
            weekends {settings.skipWeekends ? 'skipped' : 'counted'}
          </p>
        )}
      </Panel>
      )}

      <Panel
        title="Orders"
        actions={
          <button
            type="button"
            onClick={loadOrders}
            className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <FilterChips options={scopeOptions} value={scope} onChange={setScope} />
          <FilterChips options={STATUSES} value={status} onChange={setStatus} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Order number, customer name or email"
            className="flex-1 min-w-[14rem] bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
          />
        </div>

        {orders.length === 0 ? (
          <EmptyState>{loading ? 'Loading orders…' : 'No orders match these filters.'}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr>
                  <th className="py-2 pr-3">Order</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Shipping</th>
                  <th className="py-2 pr-3">Estimated delivery</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const isEditing = editing?.orderNumber === order.orderNumber;
                  const busy = busyOrder === order.orderNumber;
                  return (
                    <tr key={order.orderNumber} className={rowClass}>
                      <td className="py-2 pr-3">
                        <span className="font-mono font-bold text-white block">{order.orderNumber}</span>
                        <span className="text-[10px] text-slate-500">
                          {ORDER_TYPE_LABELS[order.orderType] ?? order.orderType} · placed{' '}
                          {formatDateTime(order.createdAt)}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <span className="block text-slate-200">{order.userName}</span>
                        <span className="text-[10px] text-slate-500">{order.userEmail}</span>
                      </td>
                      <td className="py-2 pr-3">{order.status}</td>
                      <td className="py-2 pr-3 text-slate-400">
                        {order.shippingOptionLabel || (order.orderType === 'GROUP_BUY' ? 'Included' : 'Standard Ground')}
                        {order.shippedAt && (
                          <span className="block text-[10px] text-slate-500">shipped {formatDateTime(order.shippedAt)}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {isEditing ? (
                          <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="datetime-local"
                              value={editing.date}
                              onChange={(e) => setEditing((prev) => ({ ...prev, date: e.target.value }))}
                              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                            />
                            <input
                              value={editing.note}
                              maxLength={200}
                              onChange={(e) => setEditing((prev) => ({ ...prev, note: e.target.value }))}
                              placeholder="Note for the customer (optional)"
                              className="w-56 block bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                            />
                          </div>
                        ) : (
                          <>
                            <span className="text-slate-100">
                              {order.estimatedDeliveryAt ? formatDateTime(order.estimatedDeliveryAt) : 'Not set'}
                            </span>
                            <span className="block text-[10px] text-slate-500">
                              {order.estimatedDeliverySource === 'ADMIN' ? 'set by an administrator' : 'automatic'}
                              {order.estimatedDeliveryNote ? ` · ${order.estimatedDeliveryNote}` : ''}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">{formatMoney(order.totalAmount)}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1.5 justify-end">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={busy || !editing.date}
                                onClick={() =>
                                  saveOrder(
                                    order.orderNumber,
                                    { estimatedDeliveryAt: `${editing.date}:00`, note: editing.note || null },
                                    `Delivery date updated for ${order.orderNumber}. The customer was notified.`,
                                  )
                                }
                                className="p-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-40"
                                aria-label="Save delivery date"
                              >
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditing(null)}
                                className="p-1.5 rounded-lg border border-slate-700 text-slate-300"
                                aria-label="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditing({
                                    orderNumber: order.orderNumber,
                                    date: toLocalInput(order.estimatedDeliveryAt),
                                    note: order.estimatedDeliveryNote || '',
                                  })
                                }
                                className="px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 hover:text-white font-bold"
                              >
                                Change date
                              </button>
                              {order.estimatedDeliverySource === 'ADMIN' && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  title="Back to the automatic rule"
                                  onClick={() =>
                                    saveOrder(
                                      order.orderNumber,
                                      { resetToAutomatic: true },
                                      `${order.orderNumber} is back on the automatic date.`,
                                    )
                                  }
                                  className="p-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40"
                                  aria-label="Back to the automatic rule"
                                >
                                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
