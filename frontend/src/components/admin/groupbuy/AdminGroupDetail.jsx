import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, ExternalLink, UserMinus, X, XCircle } from 'lucide-react';
import { adminGroupBuyApi, apiErrorMessage } from '../../../api/groupBuyApi';
import ActivityTimeline from '../../groupbuy/ActivityTimeline';
import GroupProgress from '../../groupbuy/GroupProgress';
import GroupStatusBadge from '../../groupbuy/GroupStatusBadge';
import { formatDateTime, formatMoney } from '../../groupbuy/format';
import {
  Banner,
  ConfirmAction,
  DISPUTE_STATUS_META,
  Loading,
  PARTICIPANT_STATUS_META,
  Pill,
  StatusPill,
  rowClass,
  tableClass,
  theadClass,
} from './adminUi';

/** Full admin view of one group: members with contact and payment details, moderation, disputes and timeline. */
export default function AdminGroupDetail({ groupId, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState(null); // { type: 'cancel' } | { type: 'remove', member }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await adminGroupBuyApi.getGroup(groupId));
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load the group'));
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const run = async (action, successMessage) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setDetail(await action());
      setNotice(successMessage);
      setConfirm(null);
      onChanged?.();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading label="Loading group…" />;
  if (!detail) return <Banner error={error || 'Group not found'} onClear={() => setError('')} />;

  const { group, members = [], disputes = [] } = detail;
  const isOpen = group.status === 'OPEN';

  return (
    <div className="space-y-4 text-xs">
      <Banner error={error} notice={notice} onClear={() => { setError(''); setNotice(''); }} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <GroupStatusBadge status={group.status} />
            <span className="font-mono font-bold text-white">{group.inviteCode}</span>
            <span className="text-slate-500">started {formatDateTime(group.createdAt)} by {group.startedByName}</span>
          </div>
          <p className="text-slate-400">
            {group.participantCount} of {group.minParticipants}–{group.maxParticipants} members ·{' '}
            {isOpen ? `closes ${formatDateTime(group.expiresAt)}` : `closed ${formatDateTime(group.completedAt)}`} · price{' '}
            {formatMoney(group.currentUnitPrice)}
          </p>
          {detail.closeReasonLabel && (
            <p className="text-rose-300">
              <strong>{detail.closeReasonLabel}.</strong> {group.failureReason}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/group-buy/groups/${group.id}`}
            target="_blank"
            className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Public page
          </Link>
          {isOpen && (
            <button
              type="button"
              onClick={() => setConfirm({ type: 'cancel' })}
              className="px-3 py-1.5 rounded-xl bg-rose-950 border border-rose-800 text-rose-300 hover:bg-rose-900 font-bold flex items-center gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" /> Cancel group
            </button>
          )}
        </div>
      </div>

      {isOpen && <GroupProgress {...group} compact />}

      {confirm?.type === 'cancel' && (
        <ConfirmAction
          title={`Cancel group ${group.inviteCode}?`}
          description={`All ${group.participantCount} active member(s) are refunded in full and notified. This cannot be undone.`}
          confirmLabel="Cancel group and refund"
          reasonRequired
          reasonPlaceholder="Shown to members, e.g. suspected duplicate accounts"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={(reason) =>
            run(() => adminGroupBuyApi.cancelGroup(group.id, reason), 'Group cancelled. Members were refunded.')
          }
        />
      )}
      {confirm?.type === 'remove' && (
        <ConfirmAction
          title={`Remove ${confirm.member.customerName} from the group?`}
          description={`${formatMoney(confirm.member.amountPaid)} is refunded. If they lead the group, leadership passes to the next member.`}
          confirmLabel="Remove and refund"
          reasonRequired
          reasonPlaceholder="Shown to the shopper"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={(reason) =>
            run(
              () => adminGroupBuyApi.removeMember(group.id, confirm.member.userId, reason),
              `${confirm.member.customerName} was removed and refunded.`
            )
          }
        />
      )}

      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead className={theadClass}>
            <tr>
              <th className="py-2 pr-3">Member</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Qty</th>
              <th className="py-2 pr-3">Paid</th>
              <th className="py-2 pr-3">Refunded</th>
              <th className="py-2 pr-3">Order</th>
              <th className="py-2 pr-3">Ships to</th>
              <th className="py-2 pr-3">Joined</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className={rowClass}>
                <td className="py-2 pr-3 min-w-[200px]">
                  <span className="font-bold text-white flex items-center gap-1">
                    {m.leader && <Crown className="w-3 h-3 text-amber-400" />} {m.customerName}
                  </span>
                  <span className="text-slate-500 block">{m.customerEmail}</span>
                  <span className="text-[10px] text-slate-600 block">
                    Account created {formatDateTime(m.accountCreatedAt)}
                    {m.invitedByEmail && ` · invited by ${m.invitedByEmail}`}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <StatusPill meta={PARTICIPANT_STATUS_META} status={m.status} />
                </td>
                <td className="py-2 pr-3 font-mono">{m.quantity}</td>
                <td className="py-2 pr-3 font-mono">
                  {formatMoney(m.amountPaid)}
                  <span className="block text-[10px] text-slate-500 whitespace-nowrap">{m.paymentMethod?.replace(/_/g, ' ')}</span>
                </td>
                <td className="py-2 pr-3 font-mono">{formatMoney(m.refundAmount)}</td>
                <td className="py-2 pr-3">
                  {m.orderNumber ? (
                    <>
                      <span className="font-mono text-white whitespace-nowrap">{m.orderNumber}</span>
                      <span className="block text-[10px] text-slate-500">{m.orderStatus}</span>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="py-2 pr-3 text-slate-400 min-w-[200px] max-w-[260px]">{m.shippingAddress}</td>
                <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">
                  {formatDateTime(m.joinedAt)}
                  {m.leftAt && <span className="block text-[10px] text-slate-500">left {formatDateTime(m.leftAt)}</span>}
                </td>
                <td className="py-2 text-right">
                  {isOpen && m.status === 'JOINED' && (
                    <button
                      type="button"
                      onClick={() => setConfirm({ type: 'remove', member: m })}
                      className="px-2 py-1 rounded-lg border border-slate-700 text-slate-400 hover:text-rose-300 hover:border-rose-800 font-bold flex items-center gap-1"
                      title="Remove and refund"
                    >
                      <UserMinus className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {disputes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Disputes on this group</h4>
          {disputes.map((d) => (
            <div key={d.id} className="p-3 rounded-2xl border border-slate-800 bg-slate-950/60 flex flex-wrap justify-between gap-2">
              <span>
                <strong className="text-white">{d.typeLabel}</strong> · {d.customerName} · {formatDateTime(d.createdAt)}
              </span>
              <span className="flex items-center gap-2">
                {Number(d.refundAmount) > 0 && <Pill tone="green">Refunded {formatMoney(d.refundAmount)}</Pill>}
                <StatusPill meta={DISPUTE_STATUS_META} status={d.status} />
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/40">
        <ActivityTimeline activities={group.activities || []} />
      </div>
    </div>
  );
}

/** Opens a group's admin detail over the current view, for links from tables, flags and disputes. */
export function GroupDetailModal({ groupId, onClose, onChanged }) {
  useEffect(() => {
    if (!groupId) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [groupId, onClose]);

  if (!groupId) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="w-full max-w-5xl my-8 bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-rose-300">Group detail</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <AdminGroupDetail groupId={groupId} onChanged={onChanged} />
      </div>
    </div>
  );
}
