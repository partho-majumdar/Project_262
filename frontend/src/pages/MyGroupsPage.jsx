import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Crown,
  Percent,
  Loader2,
  Package,
  PiggyBank,
  RefreshCcw,
  Ticket,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { groupBuyApi, apiErrorMessage } from '../api/groupBuyApi';
import CountdownTimer from '../components/groupbuy/CountdownTimer';
import GroupProgress from '../components/groupbuy/GroupProgress';
import GroupStatusBadge from '../components/groupbuy/GroupStatusBadge';
import useLiveReload, { topics } from '../components/groupbuy/useLiveReload';
import { formatDateTime, formatMoney, formatPercent, PARTICIPANT_STATUS_LABEL } from '../components/groupbuy/format';
import { downloadCsv } from '../components/groupbuy/csv';
import { inviteRoute } from '../components/groupbuy/inviteCode';
import { ChartCard, ExportButton, StackedBars, SERIES, compactMoney, shortMonth } from '../components/groupbuy/analytics/charts';

const TABS = [
  { id: 'active', label: 'Active' },
  { id: 'successful', label: 'Successful' },
  { id: 'started', label: 'Groups I started' },
  { id: 'failed', label: 'Failed' },
  { id: 'left', label: 'Left' },
  { id: 'all', label: 'All history' },
];

export default function MyGroupsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('active');
  const [groups, setGroups] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');

  const load = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        const [groupList, statsData] = await Promise.all([groupBuyApi.getMyGroups(tab), groupBuyApi.getMyStats()]);
        setGroups(Array.isArray(groupList) ? groupList : []);
        setStats(statsData);
        setError('');
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not load your groups.'));
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [tab],
  );

  useEffect(() => {
    load(true);
  }, [load]);

  useLiveReload([topics.GROUP_BUY], () => load(false));

  const statCards = stats
    ? [
        { label: 'Active groups', value: stats.activeGroups, icon: Users, color: 'text-nexus-400' },
        { label: 'Successful', value: stats.successfulGroups, icon: CheckCircle2, color: 'text-emerald-400' },
        { label: 'Started by you', value: stats.startedGroups, icon: Crown, color: 'text-amber-400' },
        { label: 'Failed', value: stats.failedGroups, icon: XCircle, color: 'text-rose-400' },
        {
          label: 'Success rate',
          value: stats.successfulGroups + stats.failedGroups ? formatPercent(stats.successRate) : '—',
          icon: Percent,
          color: 'text-nexus-300',
        },
        { label: 'Total saved', value: formatMoney(stats.totalSavings), icon: PiggyBank, color: 'text-emerald-300' },
        { label: 'Invites that joined', value: stats.successfulInvites, icon: UserPlus, color: 'text-teal-400' },
        { label: 'Refunded', value: formatMoney(stats.totalRefunded), icon: RefreshCcw, color: 'text-slate-300' },
      ]
    : [];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Ticket className="w-7 h-7 text-nexus-400" /> My group buys
          </h1>
          <p className="text-xs text-slate-400">Track your active groups, orders, savings and invites.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const route = inviteRoute(code);
              if (route) navigate(route);
            }}
            className="flex items-center gap-2"
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={200}
              placeholder="Group code or invite link"
              className="w-52 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder:font-sans placeholder:text-slate-500"
            />
            <button type="submit" className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-100">
              Join
            </button>
          </form>
          <Link to="/group-deals" className="px-4 py-2 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl text-xs font-bold">
            Browse group deals
          </Link>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="glass-card p-4 rounded-2xl border border-slate-800 space-y-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <p className="text-lg font-extrabold text-white font-mono">{value}</p>
              <p className="text-[10px] text-slate-500 font-semibold">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              tab === item.id ? 'bg-nexus-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-nexus-500 animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <div className="glass-card p-10 rounded-3xl border border-slate-800 text-center space-y-2">
          <Users className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-300">Nothing here yet</p>
          <p className="text-xs text-slate-500">Start or join a group from the group deals page.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <MyGroupRow key={group.id} group={group} />
          ))}
        </div>
      )}

      {stats?.savingsHistory?.length > 0 && <SavingsOverview stats={stats} />}

      {stats?.savingsHistory?.length > 0 && (
        <section className="glass-card p-5 rounded-3xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-emerald-400" /> Group savings history
            </h2>
            <ExportButton
              onClick={() =>
                downloadCsv('my-group-buy-savings.csv', [
                  ['Product', (e) => e.productName],
                  ['Completed', (e) => e.completedAt],
                  ['Quantity', (e) => e.quantity],
                  ['Regular unit price', (e) => e.basePrice],
                  ['Paid unit price', (e) => e.paidUnitPrice],
                  ['Saved', (e) => e.savings],
                  ['Order', (e) => e.orderNumber],
                ], stats.savingsHistory)
              }
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-800">
                  <th className="py-2 pr-3 font-semibold">Product</th>
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 pr-3 font-semibold text-right">Qty</th>
                  <th className="py-2 pr-3 font-semibold text-right">Regular</th>
                  <th className="py-2 pr-3 font-semibold text-right">You paid</th>
                  <th className="py-2 pr-3 font-semibold text-right">Saved</th>
                  <th className="py-2 font-semibold">Order</th>
                </tr>
              </thead>
              <tbody>
                {stats.savingsHistory.map((entry) => (
                  <tr key={entry.groupId} className="border-b border-slate-900 text-slate-300">
                    <td className="py-2 pr-3">
                      <Link to={`/group-buy/groups/${entry.groupId}`} className="hover:text-white">
                        {entry.productName}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(entry.completedAt)}</td>
                    <td className="py-2 pr-3 text-right font-mono">{entry.quantity}</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-500">{formatMoney(entry.basePrice)}</td>
                    <td className="py-2 pr-3 text-right font-mono">{formatMoney(entry.paidUnitPrice)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-emerald-400">{formatMoney(entry.savings)}</td>
                    <td className="py-2">
                      {entry.orderNumber && (
                        <Link to={`/orders/confirmation/${entry.orderNumber}`} className="text-nexus-400 hover:underline font-mono">
                          {entry.orderNumber}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

const SPEND_SERIES = [
  { key: 'spent', label: 'You paid', color: SERIES[0] },
  { key: 'savings', label: 'You saved', color: SERIES[2] },
];

function SavingsOverview({ stats }) {
  const months = (stats.monthly || []).map((m) => ({ ...m, spent: Number(m.spent), savings: Number(m.savings) }));
  const biggest = stats.biggestSaving;
  const lastYear = months.reduce((sum, m) => sum + m.savings, 0);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <ChartCard
        className="lg:col-span-2"
        title="Your group buys by month"
        subtitle={`${formatMoney(lastYear)} saved in the last 12 months`}
        legend={SPEND_SERIES}
        empty={!months.some((m) => m.groups)}
        emptyText="No completed group buys in the last 12 months."
        table={{
          rows: months.filter((m) => m.groups),
          columns: [
            ['Month', (m) => shortMonth(m.month)],
            ['Group buys', (m) => m.groups, 'right'],
            ['You paid', (m) => formatMoney(m.spent), 'right'],
            ['You saved', (m) => formatMoney(m.savings), 'right'],
            ['Saved to date', (m) => formatMoney(m.cumulativeSavings), 'right'],
          ],
        }}
      >
        <StackedBars data={months} xKey="month" series={SPEND_SERIES} xFormatter={shortMonth} valueFormatter={compactMoney} />
      </ChartCard>
      <section className="glass-card p-5 rounded-3xl border border-slate-800 space-y-4 text-xs">
        <h3 className="text-sm font-extrabold text-white">Savings at a glance</h3>
        <dl className="space-y-3">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Regular price of what you bought</dt>
            <dd className="font-mono text-slate-200">{formatMoney(stats.regularPriceTotal)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">You paid</dt>
            <dd className="font-mono text-slate-200">{formatMoney(stats.totalSpent)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Average discount</dt>
            <dd className="font-mono text-emerald-300">{formatPercent(stats.averageDiscountPercent)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Units bought</dt>
            <dd className="font-mono text-slate-200">{stats.unitsBought}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Groups joined</dt>
            <dd className="font-mono text-slate-200">{stats.totalParticipations}</dd>
          </div>
        </dl>
        {biggest && (
          <Link
            to={`/group-buy/groups/${biggest.groupId}`}
            className="block p-3 rounded-2xl border border-emerald-800/60 bg-emerald-950/30 hover:border-emerald-600"
          >
            <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">Biggest saving</p>
            <p className="text-white font-bold truncate">{biggest.productName}</p>
            <p className="text-slate-400">
              Saved <span className="font-mono text-emerald-300">{formatMoney(biggest.savings)}</span> on {biggest.quantity} ×{' '}
              {formatMoney(biggest.basePrice)}
            </p>
          </Link>
        )}
      </section>
    </div>
  );
}

function MyGroupRow({ group }) {
  const campaign = group.campaign;
  const membership = group.myMembership;

  return (
    <Link
      to={`/group-buy/groups/${group.id}`}
      className="glass-card p-4 rounded-3xl border border-slate-800 hover:border-nexus-500/60 flex flex-col md:flex-row gap-4 transition"
    >
      <div className="w-full md:w-24 h-24 rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0">
        {campaign.productImageUrl ? (
          <img src={campaign.productImageUrl} alt={campaign.productName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            <Package className="w-6 h-6" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <GroupStatusBadge status={group.status} />
          {group.viewerStarted && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300">
              <Crown className="w-3 h-3" /> You started this group
            </span>
          )}
          {membership && <span className="text-[10px] text-slate-400">{PARTICIPANT_STATUS_LABEL[membership.status]}</span>}
        </div>
        <p className="text-sm font-extrabold text-white line-clamp-1">{campaign.title}</p>
        {group.status === 'OPEN' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <GroupProgress {...group} compact />
            <CountdownTimer expiresAt={group.expiresAt} variant="compact" />
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">
            {group.status === 'SUCCESS'
              ? `Closed ${formatDateTime(group.completedAt)} at ${formatMoney(group.finalUnitPrice)} each`
              : group.failureReason || `Closed ${formatDateTime(group.completedAt)}`}
          </p>
        )}
      </div>

      {membership && (
        <div className="grid grid-cols-3 md:grid-cols-1 gap-2 text-right md:w-40 shrink-0 text-[11px]">
          <div>
            <p className="text-slate-500">Quantity</p>
            <p className="font-mono font-bold text-white">{membership.quantity}</p>
          </div>
          <div>
            <p className="text-slate-500">{membership.status === 'CONVERTED' ? 'Saved' : 'Paid'}</p>
            <p className="font-mono font-bold text-emerald-400">
              {membership.status === 'CONVERTED' ? formatMoney(membership.savings) : formatMoney(membership.amountPaid)}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Order</p>
            <p className="font-mono font-bold text-slate-300 truncate">{membership.orderNumber || '—'}</p>
          </div>
        </div>
      )}
    </Link>
  );
}
