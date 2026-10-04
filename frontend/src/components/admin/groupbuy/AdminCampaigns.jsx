import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, Search, StopCircle, XCircle } from 'lucide-react';
import { adminGroupBuyApi, apiErrorMessage } from '../../../api/groupBuyApi';
import GroupProgress from '../../groupbuy/GroupProgress';
import GroupStatusBadge from '../../groupbuy/GroupStatusBadge';
import PriceLadder from '../../groupbuy/PriceLadder';
import { formatDateTime, formatMoney, formatPercent } from '../../groupbuy/format';
import CampaignStatusBadge from '../../seller/groupbuy/CampaignStatusBadge';
import StatTile from '../../seller/groupbuy/StatTile';
import { inventoryAlert, isTerminal } from '../../seller/groupbuy/campaignMeta';
import AdminGroupDetail from './AdminGroupDetail';
import { Banner, ConfirmAction, EmptyState, FilterChips, Loading, rowClass, tableClass, theadClass } from './adminUi';

const FILTERS = [
  { id: 'all', label: 'All', statuses: null },
  { id: 'live', label: 'Live & scheduled', statuses: ['ACTIVE', 'SCHEDULED', 'PAUSED'] },
  { id: 'SUCCESS', label: 'Successful', statuses: ['SUCCESS'] },
  { id: 'FAILED', label: 'Failed', statuses: ['FAILED'] },
  { id: 'CANCELLED', label: 'Cancelled', statuses: ['CANCELLED'] },
  { id: 'drafts', label: 'Drafts', statuses: ['DRAFT'] },
];

export default function AdminCampaigns({ campaigns, selectedId, onSelect, onChanged }) {
  // Start on live campaigns, or on everything when nothing is live so the list isn't empty
  const [filter, setFilter] = useState(() =>
    campaigns.some((c) => ['ACTIVE', 'SCHEDULED', 'PAUSED'].includes(c.status)) ? 'live' : 'all'
  );
  const [query, setQuery] = useState('');

  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((f) => [f.id, f.statuses ? campaigns.filter((c) => f.statuses.includes(c.status)).length : campaigns.length])
      ),
    [campaigns]
  );

  const visible = useMemo(() => {
    const statuses = FILTERS.find((f) => f.id === filter)?.statuses;
    const needle = query.trim().toLowerCase();
    return campaigns
      .filter((c) => !statuses || statuses.includes(c.status))
      .filter(
        (c) =>
          !needle ||
          [c.title, c.productName, c.sellerStoreName].some((v) => v?.toLowerCase().includes(needle))
      );
  }, [campaigns, filter, query]);

  const selected = selectedId ? campaigns.find((c) => c.id === selectedId) : null;
  if (selected) {
    return <CampaignDetail campaign={selected} onBack={() => onSelect(null)} onChanged={onChanged} />;
  }

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <FilterChips options={FILTERS.map((f) => ({ ...f, count: counts[f.id] }))} value={filter} onChange={setFilter} />
        <div className="relative w-full lg:w-64">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campaign, product, store"
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 pl-9 text-slate-100"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState>No campaigns match this filter.</EmptyState>
      ) : (
        <div className="overflow-x-auto glass-panel rounded-3xl border border-slate-800 p-4">
          <table className={tableClass}>
            <thead className={theadClass}>
              <tr>
                <th className="py-2 pr-3">Campaign</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Groups (open / won / lost)</th>
                <th className="py-2 pr-3">Shoppers</th>
                <th className="py-2 pr-3">Stock (sold / reserved)</th>
                <th className="py-2 pr-3">Window</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const alert = inventoryAlert(c);
                return (
                  <tr key={c.id} className={`${rowClass} cursor-pointer`} onClick={() => onSelect(c.id)}>
                    <td className="py-2.5 pr-3">
                      <span className="font-bold text-white block">{c.title}</span>
                      <span className="text-slate-500">
                        {c.sellerStoreName} · {c.productName}
                      </span>
                      {alert && (
                        <span className={`flex items-center gap-1 text-[10px] mt-0.5 ${alert.level === 'critical' ? 'text-rose-300' : 'text-amber-300'}`}>
                          <AlertTriangle className="w-3 h-3" /> {alert.message}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <CampaignStatusBadge status={c.status} />
                    </td>
                    <td className="py-2.5 pr-3 font-mono">
                      {c.openGroupCount} / <span className="text-emerald-300">{c.successfulGroupCount}</span> /{' '}
                      <span className="text-rose-300">{c.failedGroupCount}</span>
                    </td>
                    <td className="py-2.5 pr-3 font-mono">{c.totalParticipants}</td>
                    <td className="py-2.5 pr-3 font-mono">
                      {c.soldQuantity} / {c.reservedQuantity}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-400 whitespace-nowrap">
                      {formatDateTime(c.startAt)}
                      <span className="block">→ {formatDateTime(c.endAt)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const GROUP_FILTERS = ['ALL', 'OPEN', 'SUCCESS', 'FAILED', 'CANCELLED'].map((id) => ({
  id,
  label: id === 'ALL' ? 'All' : id.charAt(0) + id.slice(1).toLowerCase(),
}));

function CampaignDetail({ campaign, onBack, onChanged }) {
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [expanded, setExpanded] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'force-close' | 'cancel'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let ignore = false;
    setGroupsLoading(true);
    adminGroupBuyApi
      .getCampaignGroups(campaign.id)
      .then((list) => !ignore && setGroups(Array.isArray(list) ? list : []))
      .catch((err) => !ignore && setError(apiErrorMessage(err, 'Could not load groups')))
      .finally(() => !ignore && setGroupsLoading(false));
    return () => {
      ignore = true;
    };
  }, [campaign.id, reload]);

  const refresh = () => {
    setReload((n) => n + 1);
    onChanged();
  };

  const act = async (type, reason) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (type === 'force-close') {
        const updated = await adminGroupBuyApi.forceCloseCampaign(campaign.id, reason);
        setNotice(`Campaign closed as ${updated.status.toLowerCase()}. Groups at their minimum became orders; the rest were refunded.`);
      } else {
        await adminGroupBuyApi.cancelCampaign(campaign.id, reason);
        setNotice('Campaign cancelled. Open groups were refunded and unsold stock was returned.');
      }
      setConfirm(null);
      refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const running = ['ACTIVE', 'PAUSED'].includes(campaign.status);
  const settled = campaign.successfulGroupCount + campaign.failedGroupCount;
  const openGroups = groups.filter((g) => g.status === 'OPEN');
  const atMinimum = openGroups.filter((g) => g.participantCount >= g.minParticipants).length;
  const visibleGroups = groupFilter === 'ALL' ? groups : groups.filter((g) => g.status === groupFilter);
  const alert = inventoryAlert(campaign);

  return (
    <div className="space-y-5 text-xs">
      <button type="button" onClick={onBack} className="text-slate-400 hover:text-white flex items-center gap-1.5 font-bold">
        <ArrowLeft className="w-4 h-4" /> All campaigns
      </button>
      <Banner error={error} notice={notice} onClear={() => { setError(''); setNotice(''); }} />

      <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col md:flex-row gap-5">
        <div className="w-full md:w-28 h-28 rounded-2xl bg-slate-800 overflow-hidden shrink-0 border border-slate-700">
          {campaign.productImageUrl && <img src={campaign.productImageUrl} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CampaignStatusBadge status={campaign.status} />
            <span className="text-[10px] text-slate-500">
              Published {formatDateTime(campaign.submittedAt)}
            </span>
          </div>
          <h2 className="text-xl font-black text-white">{campaign.title}</h2>
          <p className="text-slate-400">
            {campaign.sellerStoreName} · {campaign.productName} · {formatMoney(campaign.basePrice)} → from{' '}
            <strong className="text-emerald-300">{formatMoney(campaign.lowestPrice)}</strong> ({formatPercent(campaign.maxDiscountPercent)} off)
          </p>
          {campaign.closingNote && (
            <p className="text-slate-300">
              {campaign.closeReasonLabel ? <strong>{campaign.closeReasonLabel}: </strong> : 'Closing note: '}
              {campaign.closingNote}
            </p>
          )}
        </div>
        {!isTerminal(campaign.status) && !confirm && (
          <div className="flex md:flex-col gap-2">
            {running && (
              <button
                type="button"
                onClick={() => setConfirm('force-close')}
                className="px-3.5 py-2 rounded-xl bg-amber-950 border border-amber-800 text-amber-200 hover:bg-amber-900 font-bold flex items-center gap-1.5"
              >
                <StopCircle className="w-4 h-4" /> Force close
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirm('cancel')}
              className="px-3.5 py-2 rounded-xl bg-rose-950 border border-rose-800 text-rose-300 hover:bg-rose-900 font-bold flex items-center gap-1.5"
            >
              <XCircle className="w-4 h-4" /> Cancel campaign
            </button>
          </div>
        )}
      </div>

      {confirm === 'force-close' && (
        <ConfirmAction
          title="End this campaign now?"
          description={`${openGroups.length} open group(s) settle immediately: ${atMinimum} at or above the minimum become orders, the other ${
            openGroups.length - atMinimum
          } are refunded. Unsold reserved stock returns to the product.`}
          confirmLabel="Force close"
          tone="warn"
          reasonPlaceholder="Shown to the seller and members"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={(reason) => act('force-close', reason)}
        />
      )}
      {confirm === 'cancel' && (
        <ConfirmAction
          title="Cancel this campaign?"
          description={`No orders are created. All ${openGroups.length} open group(s) are cancelled and every member is refunded in full. Unsold stock returns to the product.`}
          confirmLabel="Cancel and refund everyone"
          reasonRequired
          reasonPlaceholder="Shown to the seller and members, e.g. misleading base price"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={(reason) => act('cancel', reason)}
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatTile label="Open groups" value={campaign.openGroupCount} />
        <StatTile label="Successful" value={campaign.successfulGroupCount} tone="good" />
        <StatTile label="Failed / cancelled" value={campaign.failedGroupCount} tone={campaign.failedGroupCount ? 'bad' : 'default'} />
        <StatTile
          label="Success rate"
          value={settled ? `${Math.round((campaign.successfulGroupCount / settled) * 100)}%` : '—'}
        />
        <StatTile label="Shoppers" value={campaign.totalParticipants} />
        <StatTile
          label="Sold / reserved"
          value={`${campaign.soldQuantity}/${campaign.reservedQuantity}`}
          hint={`${campaign.availableQuantity} available · stock ${campaign.productStock}`}
          tone={alert?.level === 'critical' ? 'bad' : alert ? 'warn' : 'default'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-rose-300">Groups</h3>
            <FilterChips options={GROUP_FILTERS} value={groupFilter} onChange={setGroupFilter} />
          </div>
          {groupsLoading ? (
            <Loading label="Loading groups…" />
          ) : visibleGroups.length === 0 ? (
            <EmptyState>No groups here.</EmptyState>
          ) : (
            <div className="space-y-2">
              {visibleGroups.map((g) => {
                const open = expanded === g.id;
                return (
                  <div key={g.id} className="rounded-2xl border border-slate-800 bg-slate-950/40">
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : g.id)}
                      className="w-full p-3 flex flex-wrap items-center gap-3 text-left"
                    >
                      {open ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                      <span className="font-mono font-bold text-white">{g.inviteCode}</span>
                      <GroupStatusBadge status={g.status} />
                      <span className="text-slate-400">led by {g.leaderName}</span>
                      <span className="ml-auto font-mono text-slate-300">
                        {g.participantCount}/{g.minParticipants} · {formatMoney(g.currentUnitPrice)}
                      </span>
                    </button>
                    {!open && g.status === 'OPEN' && (
                      <div className="px-3 pb-3">
                        <GroupProgress {...g} compact />
                      </div>
                    )}
                    {open && (
                      <div className="p-3 border-t border-slate-800">
                        <AdminGroupDetail groupId={g.id} onChanged={refresh} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
          <PriceLadder basePrice={campaign.basePrice} tiers={campaign.tiers} />
          <div className="space-y-1 text-slate-400">
            <p>Group size {campaign.minParticipants}–{campaign.maxParticipants}, up to {campaign.maxQuantityPerUser} per shopper</p>
            <p>Group timer {campaign.groupDurationHours}h</p>
            <p>
              {formatDateTime(campaign.startAt)} → {formatDateTime(campaign.endAt)}
            </p>
            <p>
              Inventory {campaign.inventoryReserved ? (campaign.inventoryReleased ? 'released' : 'held') : 'not reserved yet'} ·{' '}
              {campaign.committedQuantity} committed
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
