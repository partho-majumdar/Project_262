import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { apiErrorMessage } from '../../../api/groupBuyApi';
import { formatDateTime, formatMoney } from '../../groupbuy/format';
import { Banner, ConfirmAction, EmptyState, FilterChips, Panel, Pill, rowClass, tableClass, theadClass } from './featureUi';
import { num } from './featureConfigs';

const STATUS_META = {
  OPEN: ['Open', 'rose'],
  UNDER_REVIEW: ['Under review', 'amber'],
  RESOLVED: ['Resolved', 'green'],
  REJECTED: ['Rejected', 'slate'],
};

const FILTERS = [
  { id: 'OPEN', label: 'Open' },
  { id: 'UNDER_REVIEW', label: 'Under review' },
  { id: 'ALL', label: 'All' },
  { id: 'RESOLVED', label: 'Resolved' },
];

const TONES = { rose: 'bg-rose-500/15 text-rose-300 border-rose-700', amber: 'bg-amber-500/15 text-amber-300 border-amber-700', green: 'bg-emerald-500/15 text-emerald-300 border-emerald-700', slate: 'bg-slate-700/30 text-slate-300 border-slate-600' };

/**
 * Wholesale is the only feature with a dispute model, so this panel is Wholesale-only. The other
 * four tabs explain that no dispute model exists for them rather than showing an empty queue.
 */
export default function DisputesPanel({ api, featureLabel }) {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refund, setRefund] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.getDisputes();
      setRows(Array.isArray(list) ? list : []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load disputes'));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    if (filter === 'ALL') return rows;
    if (filter === 'OPEN') return rows.filter((row) => row.status === 'OPEN');
    return rows.filter((row) => row.status === filter);
  }, [rows, filter]);

  const openCount = rows.filter((row) => row.status === 'OPEN' || row.status === 'UNDER_REVIEW').length;

  const run = async (action, successMessage) => {
    try {
      await action();
      setNotice(successMessage);
      setError('');
      setRefund(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'That action did not go through'));
    }
  };

  return (
    <div className="space-y-4 text-xs">
      <Banner error={error} notice={notice} onClear={() => { setError(''); setNotice(''); }} />
      <p className="text-slate-400">
        {openCount} open of {rows.length} total. Disputes raised against {featureLabel} reservations.
      </p>

      <Panel
        title="Dispute queue"
        icon={openCount ? ShieldAlert : ShieldCheck}
        actions={<FilterChips options={FILTERS} value={filter} onChange={setFilter} />}
      >
        {loading ? (
          <p className="text-slate-400">Loading disputes…</p>
        ) : visible.length === 0 ? (
          <EmptyState>No disputes match this filter.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr>
                  <th className="py-2 pr-3">Dispute</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2 pr-3">Raised</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const [label, tone] = STATUS_META[row.status] ?? [row.status, 'slate'];
                  const closed = row.status === 'RESOLVED' || row.status === 'REJECTED';
                  const refundable = Math.max(0, num(row.maxRefundable) - num(row.refundedSoFar));
                  return (
                    <tr key={row.id} className={rowClass}>
                      <td className="py-2 pr-3">
                        <span className="text-slate-200 block">
                          {row.typeLabel ?? row.type} · lot {row.lotNumber ?? '—'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {row.productName} — {row.sellerStoreName} · {row.quantity} unit(s)
                        </span>
                        <span className="text-[10px] text-slate-500 block max-w-md">{row.description}</span>
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${TONES[tone]}`}>{label}</span>
                      </td>
                      <td className="py-2 pr-3">
                        <span className="text-slate-200 block">{row.customerName}</span>
                        <span className="text-[10px] text-slate-500">{row.customerEmail}</span>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <span className="text-slate-200 block">{formatMoney(row.totalAmount)}</span>
                        <span className="text-[10px] text-slate-500">up to {formatMoney(refundable)} refundable</span>
                      </td>
                      <td className="py-2 pr-3 text-slate-400">{formatDateTime(row.createdAt)}</td>
                      <td className="py-2 pr-3">
                        {closed ? (
                          <span className="text-[10px] text-slate-500">
                            {row.handledByName ?? 'System'} · {formatDateTime(row.resolvedAt)}
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1 items-end">
                            <button
                              type="button"
                              onClick={() => setRefund({ row, amount: refundable })}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                            >
                              Resolve
                            </button>
                            <button
                              type="button"
                              onClick={() => run(() => api.reviewDispute(row.id, 'Reviewing'), 'Marked as under review.')}
                              className="px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 hover:text-white font-bold"
                            >
                              Review
                            </button>
                            <button
                              type="button"
                              onClick={() => run(() => api.rejectDispute(row.id, 'Rejected by administrator'), 'Dispute rejected.')}
                              className="px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 hover:text-white font-bold"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {refund && (
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-[11px] text-slate-400 font-semibold">Refund amount</span>
            <input
              type="number"
              min={0}
              max={Math.max(0, num(refund.row.maxRefundable) - num(refund.row.refundedSoFar))}
              value={refund.amount}
              onChange={(event) => setRefund({ ...refund, amount: event.target.value })}
              className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
            />
            <span className="text-[10px] text-slate-500">
              At most {formatMoney(Math.max(0, num(refund.row.maxRefundable) - num(refund.row.refundedSoFar)))} can be
              refunded on this dispute.
            </span>
          </label>
          <ConfirmAction
            title={`Resolve dispute on ${refund.row.productName}`}
            description={`Refund ${formatMoney(refund.amount || 0)} to ${refund.row.customerName}. A resolution is final.`}
            confirmLabel="Resolve and refund"
            reasonRequired
            tone="ok"
            onCancel={() => setRefund(null)}
            onConfirm={async (reason) => {
              await run(
                () => api.resolveDispute(refund.row.id, { note: reason, refundAmount: num(refund.amount) }),
                'Dispute resolved.',
              );
            }}
          />
        </div>
      )}
    </div>
  );
}
