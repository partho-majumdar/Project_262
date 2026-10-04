import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Flag, Loader2 } from 'lucide-react';
import { DISPUTE_TYPES, apiErrorMessage, groupBuyApi } from '../../api/groupBuyApi';
import { formatDateTime, formatMoney } from './format';

const STATUS_TEXT = {
  OPEN: { label: 'Received', className: 'text-amber-300' },
  UNDER_REVIEW: { label: 'Being reviewed', className: 'text-cyan-300' },
  RESOLVED: { label: 'Resolved', className: 'text-emerald-300' },
  REJECTED: { label: 'Not approved', className: 'text-slate-400' },
};

/** Lets a member report a problem with their group buy and follow the status of earlier reports. */
export default function ReportProblemPanel({ groupId, membershipStatus }) {
  const [reports, setReports] = useState([]);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(membershipStatus === 'CONVERTED' ? 'ITEM_NOT_RECEIVED' : 'REFUND_NOT_RECEIVED');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let ignore = false;
    groupBuyApi
      .getMyDisputes()
      .then((list) => !ignore && setReports((Array.isArray(list) ? list : []).filter((d) => d.groupId === groupId)))
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [groupId]);

  const hasOpenReport = reports.some((d) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW');

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const created = await groupBuyApi.openDispute(groupId, { type, description: description.trim() });
      setReports((prev) => [created, ...prev]);
      setSent(true);
      setOpen(false);
      setDescription('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not send your report.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Flag className="w-4 h-4 text-rose-400" /> Problem with this group buy?
        </h3>
        {!open && !hasOpenReport && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setSent(false);
            }}
            className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 text-xs font-bold"
          >
            Report a problem
          </button>
        )}
      </div>

      {sent && (
        <p className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Report sent. GroupMart support will review it and notify you.
        </p>
      )}

      {open && (
        <form onSubmit={submit} className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3 text-xs">
          <label className="block space-y-1">
            <span className="text-slate-400 font-semibold">What went wrong?</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
            >
              {DISPUTE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-slate-400 font-semibold">Details</span>
            <textarea
              rows={4}
              minLength={10}
              maxLength={2000}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us what happened, including dates and amounts if relevant."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
            />
            <span className="text-[10px] text-slate-500">{description.trim().length}/2000 · at least 10 characters</span>
          </label>
          {error && (
            <p className="text-rose-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 font-bold">
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || description.trim().length < 10}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Send report
            </button>
          </div>
        </form>
      )}

      {reports.length > 0 && (
        <ul className="space-y-2 text-xs">
          {reports.map((d) => {
            const status = STATUS_TEXT[d.status] || { label: d.status, className: 'text-slate-400' };
            return (
              <li key={d.id} className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold text-slate-200">{d.typeLabel}</span>
                  <span className={`font-bold ${status.className}`}>{status.label}</span>
                </div>
                <p className="text-slate-500">Sent {formatDateTime(d.createdAt)}</p>
                {Number(d.refundAmount) > 0 && (
                  <p className="text-emerald-300">Refunded {formatMoney(d.refundAmount)}</p>
                )}
                {d.resolutionNote && <p className="text-slate-300">GroupMart: {d.resolutionNote}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
