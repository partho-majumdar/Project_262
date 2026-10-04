import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Boxes, Download, Package, RefreshCw, Search, Users } from 'lucide-react';
import { adminGroupBuyApi, apiErrorMessage } from '../../../api/groupBuyApi';
import { formatDateTime, formatMoney, timeAgo } from '../../groupbuy/format';
import CampaignStatusBadge from '../../seller/groupbuy/CampaignStatusBadge';
import { holdsReservation, inventoryAlert } from '../../seller/groupbuy/campaignMeta';
import { GroupDetailModal } from './AdminGroupDetail';
import {
  Banner,
  Bar,
  EmptyState,
  FilterChips,
  Loading,
  PARTICIPANT_STATUS_META,
  Pill,
  StatusPill,
  downloadCsv,
  listOf,
  rowClass,
  tableClass,
  theadClass,
} from './adminUi';

const VIEWS = [
  { id: 'activity', label: 'Live activity', icon: Activity },
  { id: 'participants', label: 'Participants', icon: Users },
  { id: 'orders', label: 'Group buy orders', icon: Package },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
];

const PARTICIPANT_FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'JOINED', label: 'Active' },
  { id: 'CONVERTED', label: 'Ordered' },
  { id: 'REFUNDED', label: 'Refunded' },
  { id: 'LEFT', label: 'Left' },
];

const ACTIVITY_TONES = {
  GROUP_SUCCEEDED: 'green',
  GOAL_REACHED: 'green',
  TIER_UNLOCKED: 'green',
  GROUP_FAILED: 'red',
  GROUP_CANCELLED: 'red',
  MEMBER_REMOVED: 'red',
  MEMBER_LEFT: 'amber',
  EXPIRING_SOON: 'amber',
  ALMOST_THERE: 'amber',
};

export default function MonitoringPanel({ campaigns, onOpenCampaign, onChanged }) {
  const [view, setView] = useState('activity');
  const [openGroupId, setOpenGroupId] = useState(null);

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap gap-2">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 border transition ${
              view === id ? 'bg-slate-800 border-slate-600 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {view === 'activity' && <ActivityFeed onOpenGroup={setOpenGroupId} />}
      {view === 'participants' && <ParticipantsTable onOpenGroup={setOpenGroupId} />}
      {view === 'orders' && <OrdersTable onOpenGroup={setOpenGroupId} />}
      {view === 'inventory' && <InventoryView campaigns={campaigns} onOpenCampaign={onOpenCampaign} />}

      <GroupDetailModal groupId={openGroupId} onClose={() => setOpenGroupId(null)} onChanged={onChanged} />
    </div>
  );
}

function useLoader(fetcher) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(listOf(await fetcher()));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, loading, error, setError, reload: load };
}

function RefreshButton({ onClick, loading }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold flex items-center gap-1.5"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
    </button>
  );
}

function ActivityFeed({ onOpenGroup }) {
  const fetcher = useCallback(() => adminGroupBuyApi.getActivity(150), []);
  const { rows, loading, error, setError, reload } = useLoader(fetcher);

  return (
    <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-slate-400">Latest 150 events across every group on the platform.</p>
        <RefreshButton onClick={reload} loading={loading} />
      </div>
      <Banner error={error} onClear={() => setError('')} />
      {loading && rows.length === 0 ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState>No group buy activity yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-900">
          {rows.map((a) => (
            <li key={a.id} className="py-2.5 flex flex-wrap items-start gap-3">
              <span className="w-16 shrink-0 text-slate-500" title={formatDateTime(a.createdAt)}>
                {timeAgo(a.createdAt)}
              </span>
              <Pill tone={ACTIVITY_TONES[a.type] || 'slate'}>{a.type.replace(/_/g, ' ')}</Pill>
              <span className="flex-1 min-w-[200px] text-slate-200">
                {a.message}
                {a.actorEmail && <span className="block text-[10px] text-slate-500">{a.actorEmail}</span>}
              </span>
              <button type="button" onClick={() => onOpenGroup(a.groupId)} className="text-right text-slate-400 hover:text-white">
                <span className="font-mono font-bold block">{a.inviteCode}</span>
                <span className="text-[10px]">{a.campaignTitle}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ParticipantsTable({ onOpenGroup }) {
  const [status, setStatus] = useState('ALL');
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const fetcher = useCallback(
    () => adminGroupBuyApi.getParticipants({ status, q: submitted || undefined, limit: 300 }),
    [status, submitted]
  );
  const { rows, loading, error, setError, reload } = useLoader(fetcher);

  const exportCsv = () =>
    downloadCsv('group-buy-participants.csv', [
      ['Customer', (r) => r.customerName],
      ['Email', (r) => r.customerEmail],
      ['Campaign', (r) => r.campaignTitle],
      ['Store', (r) => r.sellerStoreName],
      ['Invite code', (r) => r.inviteCode],
      ['Status', (r) => r.status],
      ['Quantity', (r) => r.quantity],
      ['Paid', (r) => r.amountPaid],
      ['Refunded', (r) => r.refundAmount],
      ['Payment reference', (r) => r.paymentReference],
      ['Order', (r) => r.orderNumber],
      ['Invited by', (r) => r.invitedByEmail],
      ['Joined', (r) => r.joinedAt],
      ['Left', (r) => r.leftAt],
    ], rows);

  return (
    <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <FilterChips options={PARTICIPANT_FILTERS} value={status} onChange={setStatus} />
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(query.trim());
          }}
        >
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, email, code, order…"
              className="w-56 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 pl-9 text-slate-100"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          </div>
          <RefreshButton onClick={reload} loading={loading} />
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold flex items-center gap-1.5 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </form>
      </div>
      <Banner error={error} onClear={() => setError('')} />
      {loading && rows.length === 0 ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState>No participants match.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead className={theadClass}>
              <tr>
                <th className="py-2 pr-3">Customer</th>
                <th className="py-2 pr-3">Campaign / group</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Qty</th>
                <th className="py-2 pr-3">Paid</th>
                <th className="py-2 pr-3">Refunded</th>
                <th className="py-2 pr-3">Order</th>
                <th className="py-2 pr-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`${rowClass} cursor-pointer`} onClick={() => onOpenGroup(r.groupId)}>
                  <td className="py-2 pr-3">
                    <span className="font-bold text-white block">{r.customerName}</span>
                    <span className="text-slate-500">{r.customerEmail}</span>
                    {!r.accountEnabled && <Pill tone="red">Suspended</Pill>}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="block text-slate-200">{r.campaignTitle}</span>
                    <span className="font-mono text-slate-500">
                      {r.inviteCode}
                      {r.leader && ' · leader'}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <StatusPill meta={PARTICIPANT_STATUS_META} status={r.status} />
                  </td>
                  <td className="py-2 pr-3 font-mono">{r.quantity}</td>
                  <td className="py-2 pr-3 font-mono">{formatMoney(r.amountPaid)}</td>
                  <td className="py-2 pr-3 font-mono">{formatMoney(r.refundAmount)}</td>
                  <td className="py-2 pr-3 font-mono">{r.orderNumber || '—'}</td>
                  <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{formatDateTime(r.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const ORDER_STATUSES = ['ALL', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];

function OrdersTable({ onOpenGroup }) {
  const fetcher = useCallback(() => adminGroupBuyApi.getOrders(300), []);
  const { rows, loading, error, setError, reload } = useLoader(fetcher);
  const [status, setStatus] = useState('ALL');

  const visible = status === 'ALL' ? rows : rows.filter((r) => r.orderStatus === status);
  const totals = useMemo(
    () => ({
      count: visible.length,
      value: visible.filter((r) => r.orderStatus !== 'CANCELLED').reduce((sum, r) => sum + Number(r.orderTotal || 0), 0),
      waiting: rows.filter((r) => r.orderStatus === 'PENDING').length,
    }),
    [rows, visible]
  );

  return (
    <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <FilterChips
          options={ORDER_STATUSES.map((id) => ({
            id,
            label: id === 'ALL' ? 'All' : id.charAt(0) + id.slice(1).toLowerCase(),
            count: id === 'ALL' ? rows.length : rows.filter((r) => r.orderStatus === id).length,
          }))}
          value={status}
          onChange={setStatus}
        />
        <RefreshButton onClick={reload} loading={loading} />
      </div>
      <p className="text-slate-400">
        {totals.count} order(s) worth <strong className="text-white">{formatMoney(totals.value)}</strong>
        {totals.waiting > 0 && <> · {totals.waiting} still waiting for the seller to confirm</>}
      </p>
      <Banner error={error} onClear={() => setError('')} />
      {loading && rows.length === 0 ? (
        <Loading />
      ) : visible.length === 0 ? (
        <EmptyState>No group buy orders here.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead className={theadClass}>
              <tr>
                <th className="py-2 pr-3">Order</th>
                <th className="py-2 pr-3">Customer</th>
                <th className="py-2 pr-3">Campaign / store</th>
                <th className="py-2 pr-3">Qty × price</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Price-drop refund</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className={`${rowClass} cursor-pointer`} onClick={() => onOpenGroup(r.groupId)}>
                  <td className="py-2 pr-3 font-mono text-white">{r.orderNumber}</td>
                  <td className="py-2 pr-3">
                    <span className="block text-slate-200">{r.customerName}</span>
                    <span className="text-slate-500">{r.customerEmail}</span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="block text-slate-200">{r.campaignTitle}</span>
                    <span className="text-slate-500">{r.sellerStoreName}</span>
                  </td>
                  <td className="py-2 pr-3 font-mono">
                    {r.quantity} × {formatMoney(r.finalUnitPrice)}
                  </td>
                  <td className="py-2 pr-3 font-mono">{formatMoney(r.orderTotal)}</td>
                  <td className="py-2 pr-3 font-mono">{Number(r.refundAmount) > 0 ? formatMoney(r.refundAmount) : '—'}</td>
                  <td className="py-2 pr-3">
                    <Pill tone={r.orderStatus === 'DELIVERED' ? 'green' : ['CANCELLED', 'REFUNDED'].includes(r.orderStatus) ? 'red' : 'blue'}>
                      {r.orderStatus}
                    </Pill>
                  </td>
                  <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{formatDateTime(r.orderCreatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function InventoryView({ campaigns, onOpenCampaign }) {
  const fetcher = useCallback(() => adminGroupBuyApi.getInventoryLogs(), []);
  const { rows: logs, loading, error, setError, reload } = useLoader(fetcher);

  const held = campaigns
    .filter((c) => holdsReservation(c.status) || c.status === 'DRAFT')
    .map((c) => ({ campaign: c, alert: inventoryAlert(c) }))
    .sort((a, b) => (b.alert?.level === 'critical') - (a.alert?.level === 'critical') || (!!b.alert - !!a.alert));

  return (
    <div className="space-y-4">
      <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
        <p className="text-slate-400">
          Stock held by live, scheduled, paused and pending campaigns. Reserved units leave product stock when a campaign goes live
          and unsold units return when it ends.
        </p>
        {held.length === 0 ? (
          <EmptyState>No campaign is holding stock.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr>
                  <th className="py-2 pr-3">Campaign</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 w-48">Reserved used</th>
                  <th className="py-2 pr-3">Reserved</th>
                  <th className="py-2 pr-3">In open groups</th>
                  <th className="py-2 pr-3">Sold</th>
                  <th className="py-2 pr-3">Available</th>
                  <th className="py-2 pr-3">Product stock</th>
                </tr>
              </thead>
              <tbody>
                {held.map(({ campaign: c, alert }) => (
                  <tr key={c.id} className={`${rowClass} cursor-pointer`} onClick={() => onOpenCampaign(c.id)}>
                    <td className="py-2 pr-3">
                      <span className="font-bold text-white block">{c.title}</span>
                      <span className="text-slate-500">{c.sellerStoreName}</span>
                      {alert && (
                        <span className={`flex items-center gap-1 text-[10px] ${alert.level === 'critical' ? 'text-rose-300' : 'text-amber-300'}`}>
                          <AlertTriangle className="w-3 h-3" /> {alert.message}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <CampaignStatusBadge status={c.status} />
                    </td>
                    <td className="py-2 pr-3">
                      <Bar
                        value={c.reservedQuantity - c.availableQuantity}
                        max={c.reservedQuantity}
                        tone={alert?.level === 'critical' ? 'bg-rose-500' : alert ? 'bg-amber-500' : 'bg-emerald-500'}
                      />
                    </td>
                    <td className="py-2 pr-3 font-mono">{c.reservedQuantity}</td>
                    <td className="py-2 pr-3 font-mono">{Math.max(0, c.committedQuantity - c.soldQuantity)}</td>
                    <td className="py-2 pr-3 font-mono">{c.soldQuantity}</td>
                    <td className="py-2 pr-3 font-mono">{c.availableQuantity}</td>
                    <td className="py-2 pr-3 font-mono">{c.productStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-rose-300">Stock movements</h3>
          <RefreshButton onClick={reload} loading={loading} />
        </div>
        <Banner error={error} onClear={() => setError('')} />
        {loading && logs.length === 0 ? (
          <Loading />
        ) : logs.length === 0 ? (
          <EmptyState>No group buy stock movements yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr>
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Movement</th>
                  <th className="py-2 pr-3">Change</th>
                  <th className="py-2 pr-3">Stock before → after</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className={`${rowClass} ${log.campaignId ? 'cursor-pointer' : ''}`}
                    onClick={() => log.campaignId && onOpenCampaign(log.campaignId)}
                  >
                    <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                    <td className="py-2 pr-3">
                      <span className="text-slate-200 block">{log.productName}</span>
                      <span className="text-slate-500">{log.sellerStoreName}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <Pill tone={log.reason === 'GROUP_BUY_RESERVE' ? 'amber' : 'green'}>
                        {log.reason === 'GROUP_BUY_RESERVE' ? 'Reserved' : 'Released'}
                      </Pill>
                    </td>
                    <td className={`py-2 pr-3 font-mono ${log.quantityChange < 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {log.quantityChange > 0 ? `+${log.quantityChange}` : log.quantityChange}
                    </td>
                    <td className="py-2 pr-3 font-mono">
                      {log.previousQuantity} → {log.newQuantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
