import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Edit3,
  ExternalLink,
  Pause,
  Play,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react';
import { sellerGroupBuyApi, apiErrorMessage } from '../../../api/groupBuyApi';
import PriceLadder from '../../groupbuy/PriceLadder';
import GroupProgress from '../../groupbuy/GroupProgress';
import GroupStatusBadge from '../../groupbuy/GroupStatusBadge';
import ParticipantList from '../../groupbuy/ParticipantList';
import { formatDateTime, formatMoney, formatPercent } from '../../groupbuy/format';
import CampaignStatusBadge from './CampaignStatusBadge';
import StatTile from './StatTile';
import GroupBuyOrdersPanel from './GroupBuyOrdersPanel';
import {
  canCancel,
  canEdit,
  canPause,
  canResume,
  canPublish,
  holdsReservation,
  inventoryAlert,
} from './campaignMeta';

const GROUP_FILTERS = ['ALL', 'OPEN', 'SUCCESS', 'FAILED', 'CANCELLED'];

export default function CampaignDetail({
  campaign,
  orders,
  busy,
  refreshKey,
  updatingOrder,
  onBack,
  onEdit,
  onAction,
  onOrderStatusChange,
}) {
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    let ignore = false;
    setGroupsLoading(true);
    setGroupsError('');
    sellerGroupBuyApi
      .getCampaignGroups(campaign.id)
      .then((list) => !ignore && setGroups(Array.isArray(list) ? list : []))
      .catch((err) => !ignore && setGroupsError(apiErrorMessage(err, 'Could not load groups')))
      .finally(() => !ignore && setGroupsLoading(false));
    return () => {
      ignore = true;
    };
  }, [campaign.id, refreshKey]);

  const groupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups]);
  const campaignOrders = useMemo(
    () => orders.filter((o) => o.groupBuyGroupId && groupIds.has(o.groupBuyGroupId)),
    [orders, groupIds]
  );
  const revenue = campaignOrders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const visibleGroups = groupFilter === 'ALL' ? groups : groups.filter((g) => g.status === groupFilter);
  const alert = inventoryAlert(campaign);
  const settled = campaign.successfulGroupCount + campaign.failedGroupCount;
  const successRate = settled > 0 ? Math.round((campaign.successfulGroupCount / settled) * 100) : null;
  const reservedUsedPct =
    campaign.reservedQuantity > 0
      ? Math.min(100, Math.round(((campaign.reservedQuantity - campaign.availableQuantity) / campaign.reservedQuantity) * 100))
      : 0;

  const confirmCancel = () => {
    onAction('cancel', campaign, cancelReason.trim());
    setCancelOpen(false);
    setCancelReason('');
  };

  const actionButton = 'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50';

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 font-bold">
        <ArrowLeft className="w-4 h-4" /> Back to campaigns
      </button>

      <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col md:flex-row gap-5">
        <div className="w-full md:w-28 h-28 rounded-2xl bg-slate-800 overflow-hidden shrink-0 border border-slate-700">
          {campaign.productImageUrl && (
            <img src={campaign.productImageUrl} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CampaignStatusBadge status={campaign.status} />
            <span className="text-[10px] text-slate-500">Created {formatDateTime(campaign.createdAt)}</span>
          </div>
          <h2 className="text-xl font-black text-white">{campaign.title}</h2>
          <p className="text-xs text-slate-400">
            {campaign.productName} · {formatMoney(campaign.basePrice)} → from{' '}
            <strong className="text-emerald-300">{formatMoney(campaign.lowestPrice)}</strong> (up to{' '}
            {formatPercent(campaign.maxDiscountPercent)} off)
          </p>
          {campaign.description && <p className="text-xs text-slate-300">{campaign.description}</p>}
        </div>
        <div className="flex flex-wrap md:flex-col gap-2 md:items-stretch">
          {canEdit(campaign.status) && (
            <button onClick={() => onEdit(campaign)} disabled={busy} className={`${actionButton} bg-slate-900 border border-slate-700 hover:border-indigo-500 text-slate-100`}>
              <Edit3 className="w-4 h-4" /> Edit
            </button>
          )}
          {canPublish(campaign.status) && (
            <button onClick={() => onAction('publish', campaign)} disabled={busy} className={`${actionButton} bg-indigo-600 hover:bg-indigo-500 text-white`}>
              <Send className="w-4 h-4" /> Publish campaign
            </button>
          )}
          {canPause(campaign.status) && (
            <button onClick={() => onAction('pause', campaign)} disabled={busy} className={`${actionButton} bg-orange-600 hover:bg-orange-500 text-white`}>
              <Pause className="w-4 h-4" /> Pause
            </button>
          )}
          {canResume(campaign.status) && (
            <button onClick={() => onAction('resume', campaign)} disabled={busy} className={`${actionButton} bg-emerald-600 hover:bg-emerald-500 text-white`}>
              <Play className="w-4 h-4" /> Resume
            </button>
          )}
          {canCancel(campaign.status) && (
            <button onClick={() => setCancelOpen((v) => !v)} disabled={busy} className={`${actionButton} bg-slate-900 border border-rose-800 hover:bg-rose-950 text-rose-300`}>
              <XCircle className="w-4 h-4" /> Cancel campaign
            </button>
          )}
        </div>
      </div>

      {cancelOpen && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800 space-y-3 text-xs">
          <p className="text-rose-200">
            {holdsReservation(campaign.status)
              ? `Cancelling refunds every member of the ${campaign.openGroupCount} open group(s) and returns unsold reserved units to product stock. This cannot be undone.`
              : 'This campaign will be cancelled and can no longer be edited or submitted. This cannot be undone.'}
          </p>
          <input
            type="text"
            maxLength={500}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason shown to members (optional)"
            className="w-full bg-slate-950 border border-rose-900 rounded-xl px-3 py-2 text-slate-100"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setCancelOpen(false)} className="px-3 py-1.5 bg-slate-900 border border-slate-700 text-slate-300 rounded-lg font-bold">
              Keep campaign
            </button>
            <button onClick={confirmCancel} disabled={busy} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold disabled:opacity-50">
              Confirm cancellation
            </button>
          </div>
        </div>
      )}

      {campaign.closingNote && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700 text-slate-300 text-xs">
          <strong className="block mb-0.5 text-white">Closing note</strong>
          {campaign.closingNote} {campaign.closedAt && `(${formatDateTime(campaign.closedAt)})`}
        </div>
      )}
      {alert && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-2 ${
            alert.level === 'critical' ? 'bg-rose-950/50 border-rose-800 text-rose-200' : 'bg-amber-950/40 border-amber-800 text-amber-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" /> {alert.message}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile label="Open groups" value={campaign.openGroupCount} />
        <StatTile label="Successful groups" value={campaign.successfulGroupCount} tone="good" hint={successRate != null ? `${successRate}% success rate` : undefined} />
        <StatTile label="Failed groups" value={campaign.failedGroupCount} tone={campaign.failedGroupCount > 0 ? 'bad' : 'default'} />
        <StatTile label="Participants" value={campaign.totalParticipants} />
        <StatTile label="Order revenue" value={formatMoney(revenue)} hint={`${campaignOrders.length} order(s)`} tone="good" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 text-xs">
          <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider">Inventory</h3>
          <dl className="grid grid-cols-2 gap-y-2">
            <dt className="text-slate-400">Reserved</dt>
            <dd className="text-right font-mono font-bold text-white">{campaign.reservedQuantity}</dd>
            <dt className="text-slate-400">Sold</dt>
            <dd className="text-right font-mono font-bold text-emerald-300">{campaign.soldQuantity}</dd>
            <dt className="text-slate-400">Still available</dt>
            <dd className="text-right font-mono font-bold text-white">{campaign.availableQuantity}</dd>
            <dt className="text-slate-400">{holdsReservation(campaign.status) ? 'Regular stock (after reserve)' : 'Product stock'}</dt>
            <dd className="text-right font-mono font-bold text-white">{campaign.productStock}</dd>
          </dl>
          <div className="h-2 bg-slate-950 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${reservedUsedPct}%` }} />
          </div>
          <p className="text-[10px] text-slate-500">{reservedUsedPct}% of reserved units committed or sold</p>
        </section>

        <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 text-xs">
          <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider">Rules & schedule</h3>
          <dl className="grid grid-cols-2 gap-y-2">
            <dt className="text-slate-400">Group size</dt>
            <dd className="text-right font-bold text-white">
              {campaign.minParticipants}–{campaign.maxParticipants} people
            </dd>
            <dt className="text-slate-400">Max per customer</dt>
            <dd className="text-right font-bold text-white">{campaign.maxQuantityPerUser} unit(s)</dd>
            <dt className="text-slate-400">Group duration</dt>
            <dd className="text-right font-bold text-white">{campaign.groupDurationHours} h</dd>
            <dt className="text-slate-400">Starts</dt>
            <dd className="text-right font-bold text-white">{formatDateTime(campaign.startAt)}</dd>
            <dt className="text-slate-400">Ends</dt>
            <dd className="text-right font-bold text-white">{formatDateTime(campaign.endAt)}</dd>
            {campaign.submittedAt && (
              <>
                <dt className="text-slate-400">Published</dt>
                <dd className="text-right font-bold text-white">{formatDateTime(campaign.submittedAt)}</dd>
              </>
            )}
          </dl>
        </section>

        <section className="glass-panel p-5 rounded-3xl border border-slate-800">
          <PriceLadder basePrice={campaign.basePrice} tiers={campaign.tiers} />
        </section>
      </div>

      <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider">Groups ({groups.length})</h3>
          <div className="flex flex-wrap items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            {GROUP_FILTERS.map((st) => (
              <button
                key={st}
                onClick={() => setGroupFilter(st)}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  groupFilter === st ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {st === 'ALL' ? 'All' : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {groupsLoading && (
          <p className="text-xs text-slate-400 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading groups…
          </p>
        )}
        {groupsError && <p className="text-xs text-rose-300">{groupsError}</p>}
        {!groupsLoading && !groupsError && visibleGroups.length === 0 && (
          <p className="text-xs text-slate-500">
            {groups.length === 0 ? 'No customer has started a group yet.' : 'No groups match this filter.'}
          </p>
        )}

        <ul className="space-y-2">
          {visibleGroups.map((group) => {
            const expanded = expandedGroupId === group.id;
            return (
              <li key={group.id} className="rounded-2xl border border-slate-800 bg-slate-950/50">
                <button
                  onClick={() => setExpandedGroupId(expanded ? null : group.id)}
                  className="w-full p-4 grid grid-cols-1 md:grid-cols-[auto_1fr_1.4fr_auto] gap-3 md:items-center text-left text-xs"
                >
                  <span className="flex items-center gap-2">
                    {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <span className="font-mono font-bold text-white">{group.inviteCode}</span>
                  </span>
                  <span className="space-y-0.5">
                    <span className="flex items-center gap-2">
                      <GroupStatusBadge status={group.status} />
                      <span className="text-slate-400">Leader: {group.leaderName}</span>
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      {group.status === 'OPEN'
                        ? `Expires ${formatDateTime(group.expiresAt)}`
                        : `Closed ${formatDateTime(group.completedAt)}`}
                    </span>
                  </span>
                  <GroupProgress
                    compact
                    participantCount={group.participantCount}
                    minParticipants={group.minParticipants}
                    maxParticipants={group.maxParticipants}
                    spotsToMinimum={group.spotsToMinimum}
                    spotsLeft={group.spotsLeft}
                    almostThere={group.almostThere}
                  />
                  <span className="text-right">
                    <span className="block font-mono font-extrabold text-white">
                      {formatMoney(group.finalUnitPrice ?? group.currentUnitPrice)}
                    </span>
                    <span className="block text-[10px] text-slate-500">{group.totalQuantity} unit(s)</span>
                  </span>
                </button>
                {expanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-800 pt-3">
                    {group.failureReason && <p className="text-xs text-rose-300">Reason: {group.failureReason}</p>}
                    <ParticipantList participants={group.participants || []} />
                    <Link
                      to={`/group-buy/groups/${group.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-300 hover:text-indigo-200"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open group page
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider">Orders from this campaign</h3>
        <GroupBuyOrdersPanel
          orders={campaignOrders}
          updatingOrder={updatingOrder}
          onStatusChange={onOrderStatusChange}
          emptyText="Orders appear here when a group succeeds."
        />
      </section>
    </div>
  );
}
