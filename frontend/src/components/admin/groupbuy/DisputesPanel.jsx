import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, Loader2, RefreshCw, Search, XCircle } from 'lucide-react';
import { adminGroupBuyApi, apiErrorMessage } from '../../../api/groupBuyApi';
import { formatDateTime, formatMoney, timeAgo } from '../../groupbuy/format';
import GroupStatusBadge from '../../groupbuy/GroupStatusBadge';
import { GroupDetailModal } from './AdminGroupDetail';
import {
  Banner,
  ConfirmAction,
  DISPUTE_STATUS_META,
  EmptyState,
  FilterChips,
  Loading,
  PARTICIPANT_STATUS_META,
  StatusPill,
  listOf,
} from './adminUi';

const FILTERS = [
  { id: 'ACTIVE', label: 'Needs action', statuses: ['OPEN', 'UNDER_REVIEW'] },
  { id: 'OPEN', label: 'New', statuses: ['OPEN'] },
  { id: 'UNDER_REVIEW', label: 'In review', statuses: ['UNDER_REVIEW'] },
  { id: 'RESOLVED', label: 'Resolved', statuses: ['RESOLVED'] },
  { id: 'REJECTED', label: 'Rejected', statuses: ['REJECTED'] },
  { id: 'ALL', label: 'All', statuses: null },
];

export default function DisputesPanel({ onChanged }) {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ACTIVE');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [openGroupId, setOpenGroupId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDisputes(listOf(await adminGroupBuyApi.getDisputes('ALL')));
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load disputes'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((f) => [f.id, f.statuses ? disputes.filter((d) => f.statuses.includes(d.status)).length : disputes.length])
      ),
    [disputes]
  );

  const visible = useMemo(() => {
    const statuses = FILTERS.find((f) => f.id === filter)?.statuses;
    const needle = query.trim().toLowerCase();
    return disputes
      .filter((d) => !statuses || statuses.includes(d.status))
      .filter((d) =>
        !needle ||
        [d.customerName, d.customerEmail, d.campaignTitle, d.sellerStoreName, d.orderNumber, d.inviteCode].some((v) =>
          v?.toLowerCase().includes(needle)
        )
      );
  }, [disputes, filter, query]);

  const selected = disputes.find((d) => d.id === selectedId) || null;

  const handleUpdated = (updated, message) => {
    setDisputes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    setNotice(message);
    setError('');
    onChanged?.();
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <FilterChips options={FILTERS.map((f) => ({ ...f, count: counts[f.id] }))} value={filter} onChange={setFilter} />
        <div className="flex gap-2">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Customer, campaign, order"
              className="w-56 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 pl-9 text-slate-100"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          </div>
          <button
            type="button"
            onClick={load}
            className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <Banner error={error} notice={notice} onClear={() => { setError(''); setNotice(''); }} />

      {loading && disputes.length === 0 ? (
        <Loading label="Loading disputes…" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 space-y-2">
            {visible.length === 0 ? (
              <EmptyState>No disputes here.</EmptyState>
            ) : (
              visible.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedId(d.id)}
                  className={`w-full text-left p-3 rounded-2xl border transition space-y-1 ${
                    selectedId === d.id ? 'border-rose-600 bg-rose-950/20' : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-white">{d.typeLabel}</strong>
                    <StatusPill meta={DISPUTE_STATUS_META} status={d.status} />
                  </div>
                  <p className="text-slate-400 truncate">
                    {d.customerName} · {d.campaignTitle}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {timeAgo(d.createdAt)} · paid {formatMoney(d.amountPaid)}
                    {d.orderNumber && ` · ${d.orderNumber}`}
                  </p>
                </button>
              ))
            )}
          </div>
          <div className="lg:col-span-3">
            {selected ? (
              <DisputeDetail
                key={selected.id}
                dispute={selected}
                onOpenGroup={setOpenGroupId}
                onUpdated={handleUpdated}
                onError={setError}
              />
            ) : (
              <EmptyState>Select a dispute to review it.</EmptyState>
            )}
          </div>
        </div>
      )}

      <GroupDetailModal groupId={openGroupId} onClose={() => setOpenGroupId(null)} onChanged={load} />
    </div>
  );
}

function DisputeDetail({ dispute: d, onOpenGroup, onUpdated, onError }) {
  const [mode, setMode] = useState(null); // 'resolve' | 'reject'
  const [refund, setRefund] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const closed = d.status === 'RESOLVED' || d.status === 'REJECTED';
  const maxRefund = Number(d.maxRefundable || 0);

  const call = async (fn, message) => {
    setBusy(true);
    try {
      onUpdated(await fn(), message);
      setMode(null);
    } catch (err) {
      onError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const refundValue = Number(refund || 0);
  const refundInvalid = Number.isNaN(refundValue) || refundValue < 0 || refundValue > maxRefund;
  const resolveBlocked = busy || refundInvalid || (refundValue === 0 && !note.trim());

  return (
    <article className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <StatusPill meta={DISPUTE_STATUS_META} status={d.status} />
            <span className="text-slate-500">Opened {formatDateTime(d.createdAt)}</span>
          </div>
          <h3 className="text-base font-black text-white">{d.typeLabel}</h3>
          <p className="text-slate-400">
            {d.customerName} · <a href={`mailto:${d.customerEmail}`} className="hover:underline">{d.customerEmail}</a>
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenGroup(d.groupId)}
          className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold flex items-center gap-1.5"
        >
          <Eye className="w-3.5 h-3.5" /> Group {d.inviteCode}
        </button>
      </div>

      <blockquote className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-slate-200 whitespace-pre-wrap">
        {d.description}
      </blockquote>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[
          ['Campaign', d.campaignTitle],
          ['Store', d.sellerStoreName],
          ['Group', <GroupStatusBadge key="g" status={d.groupStatus} />],
          ['Participation', <StatusPill key="p" meta={PARTICIPANT_STATUS_META} status={d.participantStatus} />],
          ['Order', d.orderNumber ? `${d.orderNumber} (${d.orderStatus})` : 'No order'],
          ['Paid / refunded', `${formatMoney(d.amountPaid)} / ${formatMoney(d.refundedSoFar)}`],
        ].map(([label, value]) => (
          <div key={label} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 min-w-0">
            <span className="text-[10px] text-slate-500 block">{label}</span>
            <span className="text-slate-200 font-semibold break-words">{value}</span>
          </div>
        ))}
      </div>

      {(closed || d.resolutionNote) && (
        <div className="p-3 rounded-2xl border border-slate-800 bg-slate-950/40 space-y-1">
          {closed && (
            <p className="text-slate-300">
              {d.status === 'RESOLVED' ? 'Resolved' : 'Rejected'} by {d.handledByName} on {formatDateTime(d.resolvedAt)}
              {Number(d.refundAmount) > 0 && (
                <>
                  {' '}with a refund of <strong className="text-emerald-300">{formatMoney(d.refundAmount)}</strong>
                </>
              )}
              .
            </p>
          )}
          {d.resolutionNote && <p className="text-slate-400">Note: {d.resolutionNote}</p>}
        </div>
      )}

      {!closed && mode === null && (
        <div className="flex flex-wrap justify-end gap-2">
          {d.status === 'OPEN' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => call(() => adminGroupBuyApi.reviewDispute(d.id), 'Dispute moved to review. The shopper was notified.')}
              className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Start review
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode('reject')}
            className="px-3 py-1.5 rounded-xl border border-rose-800 text-rose-300 hover:bg-rose-950 font-bold flex items-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" /> Reject
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('resolve');
              setRefund(maxRefund > 0 ? maxRefund.toFixed(2) : '0');
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
          </button>
        </div>
      )}

      {mode === 'reject' && (
        <ConfirmAction
          title="Reject this dispute?"
          description="The shopper is notified with your reason."
          confirmLabel="Reject dispute"
          reasonLabel="Reason for the shopper"
          reasonRequired
          busy={busy}
          onCancel={() => setMode(null)}
          onConfirm={(reason) => call(() => adminGroupBuyApi.rejectDispute(d.id, reason), 'Dispute rejected.')}
        />
      )}

      {mode === 'resolve' && (
        <div className="p-4 rounded-2xl border border-emerald-800 bg-emerald-950/20 space-y-3">
          <p className="font-bold text-white">Resolve dispute</p>
          <label className="block space-y-1">
            <span className="text-[11px] text-slate-400 font-semibold">
              Refund amount (up to {formatMoney(maxRefund)})
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              max={maxRefund}
              value={refund}
              disabled={maxRefund === 0}
              onChange={(e) => setRefund(e.target.value)}
              className="w-40 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono disabled:opacity-50"
            />
            {maxRefund === 0 && (
              <span className="block text-slate-500">
                Nothing is refundable: this participation has no captured payment left. Resolve with a note instead.
              </span>
            )}
            {refundInvalid && <span className="block text-rose-300">Enter an amount between ৳0.00 and {formatMoney(maxRefund)}.</span>}
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] text-slate-400 font-semibold">
              Note for the shopper {refundValue === 0 && <span className="text-rose-400">(required without a refund)</span>}
            </span>
            <textarea
              rows={2}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
            />
          </label>
          {refundValue > 0 && !refundInvalid && (
            <p className="text-emerald-200">
              {formatMoney(refundValue)} is refunded to the original payment method on order {d.orderNumber}. The seller is notified.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setMode(null)} className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 font-bold">
              Back
            </button>
            <button
              type="button"
              disabled={resolveBlocked}
              onClick={() =>
                call(
                  () => adminGroupBuyApi.resolveDispute(d.id, { refundAmount: refundValue, note: note.trim() || undefined }),
                  refundValue > 0 ? `Resolved with a ${formatMoney(refundValue)} refund.` : 'Dispute resolved.'
                )
              }
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {refundValue > 0 ? `Refund ${formatMoney(refundValue)} and resolve` : 'Resolve without refund'}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
