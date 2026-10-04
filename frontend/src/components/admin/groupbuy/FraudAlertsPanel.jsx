import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Eye, RefreshCw, ShieldAlert, ShieldCheck, UserX } from 'lucide-react';
import axiosClient from '../../../api/axiosClient';
import { adminGroupBuyApi, apiErrorMessage } from '../../../api/groupBuyApi';
import { formatDateTime } from '../../groupbuy/format';
import { GroupDetailModal } from './AdminGroupDetail';
import { Banner, ConfirmAction, EmptyState, FilterChips, Loading, Pill, listOf } from './adminUi';

const WINDOWS = [
  { id: 7, label: '7 days' },
  { id: 30, label: '30 days' },
  { id: 90, label: '90 days' },
];

const RULES = [
  ['Repeated join and leave', 'Leaving 3+ groups in the period (5+ is high risk).'],
  ['Many accounts, one address, same group', '3+ accounts in one group ship to the same address.'],
  ['Many accounts at one address', '4+ accounts across groups share a shipping address (6+ is high risk).'],
  ['Buyer linked to the seller', "A buyer ships to an address saved on the seller's own account."],
  ['Group filled by brand-new accounts', 'At least 60% of a 3+ member group joined within 48h of signing up.'],
  ['Invites bring in brand-new accounts', 'One inviter brought in 3+ accounts created under 48h before joining.'],
  ['Frequent disputes', '3+ disputes opened by one shopper in the period.'],
];

export default function FraudAlertsPanel({ onOpenCampaign, onChanged }) {
  const [days, setDays] = useState(30);
  const [showReviewed, setShowReviewed] = useState(false);
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reviewing, setReviewing] = useState(null); // { flag, decision }
  const [busy, setBusy] = useState(false);
  const [openGroupId, setOpenGroupId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setFlags(listOf(await adminGroupBuyApi.getFraudFlags(days, showReviewed)));
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not run fraud checks'));
    } finally {
      setLoading(false);
    }
  }, [days, showReviewed]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (flag, decision, note) => {
    setBusy(true);
    setError('');
    try {
      await adminGroupBuyApi.reviewFlag({ key: flag.key, decision, note }, days);
      setNotice(
        decision === 'DISMISSED'
          ? 'Flag dismissed. It comes back only if new evidence appears.'
          : 'Flag confirmed and recorded in the audit log.'
      );
      setReviewing(null);
      await load();
      onChanged?.();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const suspend = async (user) => {
    setBusy(true);
    setError('');
    try {
      await axiosClient.put(`/admin/users/${user.id}/status?enabled=false`);
      setNotice(`${user.email} was suspended.`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not suspend the account'));
    } finally {
      setBusy(false);
    }
  };

  const high = flags.filter((f) => f.severity === 'HIGH' && !f.reviewDecision).length;

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <FilterChips options={WINDOWS} value={days} onChange={setDays} />
          <label className="flex items-center gap-2 text-slate-400">
            <input type="checkbox" checked={showReviewed} onChange={(e) => setShowReviewed(e.target.checked)} />
            Show reviewed flags
          </label>
        </div>
        <button
          type="button"
          onClick={load}
          className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold flex items-center gap-1.5 self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Re-run checks
        </button>
      </div>

      <Banner error={error} notice={notice} onClear={() => { setError(''); setNotice(''); }} />

      {!loading && (
        <p className="text-slate-400">
          {flags.length === 0
            ? 'No suspicious patterns found in this period.'
            : `${flags.length} flag(s) to review${high ? `, ${high} high risk` : ''}. Flags are signals, not proof: open the group and check before acting.`}
        </p>
      )}

      {loading && flags.length === 0 ? (
        <Loading label="Running fraud checks…" />
      ) : flags.length === 0 ? (
        <EmptyState>
          <ShieldCheck className="w-6 h-6 mx-auto mb-2 text-emerald-400" /> All clear.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {flags.map((flag) => (
            <article
              key={flag.key}
              className={`p-4 rounded-3xl border space-y-3 ${
                flag.severity === 'HIGH' ? 'border-rose-800 bg-rose-950/20' : 'border-amber-800/70 bg-amber-950/10'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={flag.severity === 'HIGH' ? 'red' : 'amber'}>{flag.severity} risk</Pill>
                    <span className="text-slate-400 font-semibold">{flag.ruleLabel}</span>
                    {flag.reviewDecision && (
                      <Pill tone={flag.reviewDecision === 'CONFIRMED' ? 'red' : 'slate'}>
                        {flag.reviewDecision === 'CONFIRMED' ? 'Confirmed' : 'Dismissed'} by {flag.reviewedByName}
                      </Pill>
                    )}
                  </div>
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <ShieldAlert className={`w-4 h-4 ${flag.severity === 'HIGH' ? 'text-rose-400' : 'text-amber-400'}`} /> {flag.title}
                  </h4>
                  <p className="text-slate-300">{flag.description}</p>
                  {flag.reviewNote && <p className="text-slate-500">Review note: {flag.reviewNote}</p>}
                </div>
                <span className="text-slate-500">Last seen {formatDateTime(flag.lastSeenAt)}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {flag.users.map((u) => (
                  <span key={u.id} className="px-2.5 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-2">
                    <span>
                      <span className="text-white font-semibold">{u.name}</span>{' '}
                      <span className="text-slate-500">{u.email}</span>
                    </span>
                    {u.enabled ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => suspend(u)}
                        className="text-slate-500 hover:text-rose-300 disabled:opacity-40"
                        title="Suspend account"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <Pill tone="red">Suspended</Pill>
                    )}
                  </span>
                ))}
              </div>

              {reviewing?.flag.key === flag.key ? (
                <ConfirmAction
                  title={reviewing.decision === 'DISMISSED' ? 'Dismiss this flag?' : 'Confirm this as abuse?'}
                  description={
                    reviewing.decision === 'DISMISSED'
                      ? 'It stays hidden unless the pattern grows. Your note is kept in the audit log.'
                      : 'The decision is recorded in the audit log. Cancel groups, remove members or suspend accounts separately.'
                  }
                  confirmLabel={reviewing.decision === 'DISMISSED' ? 'Dismiss' : 'Confirm abuse'}
                  reasonLabel="Note"
                  reasonRequired={reviewing.decision === 'DISMISSED'}
                  reasonPlaceholder={reviewing.decision === 'DISMISSED' ? 'e.g. verified: family household' : ''}
                  tone={reviewing.decision === 'DISMISSED' ? 'ok' : 'danger'}
                  busy={busy}
                  onCancel={() => setReviewing(null)}
                  onConfirm={(note) => review(flag, reviewing.decision, note)}
                />
              ) : (
                <div className="flex flex-wrap justify-end gap-2">
                  {flag.groupId && (
                    <button
                      type="button"
                      onClick={() => setOpenGroupId(flag.groupId)}
                      className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" /> Open group {flag.inviteCode}
                    </button>
                  )}
                  {flag.campaignId && (
                    <button
                      type="button"
                      onClick={() => onOpenCampaign(flag.campaignId)}
                      className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold"
                    >
                      Campaign: {flag.campaignTitle}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setReviewing({ flag, decision: 'DISMISSED' })}
                    className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewing({ flag, decision: 'CONFIRMED' })}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" /> Confirm abuse
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <details className="glass-panel p-4 rounded-2xl border border-slate-800">
        <summary className="cursor-pointer font-bold text-slate-300">How flags are detected</summary>
        <ul className="mt-3 space-y-1.5 text-slate-400">
          {RULES.map(([name, rule]) => (
            <li key={name}>
              <strong className="text-slate-200">{name}:</strong> {rule}
            </li>
          ))}
        </ul>
      </details>

      <GroupDetailModal groupId={openGroupId} onClose={() => setOpenGroupId(null)} onChanged={() => { load(); onChanged?.(); }} />
    </div>
  );
}
