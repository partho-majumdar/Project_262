import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Download, Loader2, Pencil, RefreshCw, Trophy, X } from 'lucide-react';
import { apiErrorMessage } from '../../../api/groupBuyApi';
import StatTile from '../../seller/groupbuy/StatTile';
import CampaignStatusBadge from '../../seller/groupbuy/CampaignStatusBadge';
import { downloadCsv } from '../csv';
import { formatDateTime, formatMoney, formatPercent } from '../format';
import {
  ChartCard,
  DataTable,
  ExportButton,
  GrowthArea,
  Lines,
  RankedBars,
  SERIES,
  SplitBar,
  StackedBars,
  compactMoney,
  shortDate,
} from './charts';

export const WINDOWS = [
  { id: 7, label: 'Last 7 days' },
  { id: 30, label: 'Last 30 days' },
  { id: 90, label: 'Last 90 days' },
  { id: 0, label: 'All time' },
];

const ACCENTS = {
  indigo: 'bg-indigo-600 border-indigo-500 text-white',
  rose: 'bg-rose-600 border-rose-500 text-white',
};

const COMPARE_LIMIT = 3;
const pct = (value) => formatPercent(value);
const num = (value) => Number(value ?? 0);

/**
 * Group buy analytics for one seller store (`scope="seller"`) or the whole platform (`scope="platform"`).
 * `fetchAnalytics(days)` returns the analytics DTO; `onSaveUnitCost(campaignId, cost)` enables profit tracking.
 */
export default function AnalyticsDashboard({ scope, fetchAnalytics, onOpenCampaign, onSaveUnitCost, accent = 'indigo' }) {
  const seller = scope === 'seller';
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await fetchAnalytics(days));
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load analytics'));
    } finally {
      setLoading(false);
    }
  }, [days, fetchAnalytics]);

  useEffect(() => {
    load();
  }, [load]);

  const fileName = (name) => `group-buy-${seller ? 'store' : 'platform'}-${name}-${days > 0 ? `${days}d` : 'all-time'}.csv`;

  if (!data) {
    return error ? (
      <ErrorBanner message={error} onRetry={load} />
    ) : (
      <div className="py-12 text-center text-slate-400 text-xs">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-3" /> Building analytics…
      </div>
    );
  }

  const s = data.summary;
  return (
    <div className="space-y-5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setDays(w.id)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition ${
                days === w.id ? ACCENTS[accent] : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 hidden sm:inline">Updated {formatDateTime(data.generatedAt)}</span>
          <button
            type="button"
            onClick={load}
            className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => exportSummary(data, fileName('summary'), seller)}
            className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-100 hover:text-white font-bold flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export summary
          </button>
        </div>
      </div>
      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
        <p className="text-slate-500">
          Money and outcomes cover groups that closed in the period. Joins cover people who joined in the period. Live
          figures (open groups, held stock) are as of now.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile
            label="Revenue"
            value={formatMoney(s.revenue)}
            hint={`${pct(s.realizationRate)} of ${formatMoney(s.expectedRevenue)} expected`}
            tone="good"
          />
          <StatTile
            label="Group success rate"
            value={s.groupsClosed ? pct(s.successRate) : '—'}
            hint={`${s.groupsSucceeded} won · ${s.groupsFailed + s.groupsCancelled} failed of ${s.groupsClosed} closed`}
            tone={!s.groupsClosed ? 'default' : num(s.successRate) >= 50 ? 'good' : 'warn'}
          />
          <StatTile
            label="Conversion rate"
            value={s.closedGroupMembers ? pct(s.conversionRate) : '—'}
            hint={`${s.convertedMembers} of ${s.closedGroupMembers} members got an order`}
          />
          <StatTile
            label="Average group size"
            value={s.groupsSucceeded ? s.averageGroupSize : '—'}
            hint={`successful groups · ${s.averageClosedGroupSize} across all closed`}
          />
          <StatTile
            label="Participants joined"
            value={s.participantsJoined}
            hint={`${s.uniqueCustomers} shoppers · ${s.repeatCustomers} repeat · ${pct(s.inviteShare)} via invites`}
          />
          <StatTile
            label="Shopper savings"
            value={formatMoney(s.customerSavings)}
            hint={`${pct(s.averageDiscountPercent)} average discount`}
          />
          <StatTile
            label="Units sold"
            value={s.unitsSold}
            hint={`${pct(s.sellThroughRate)} sell-through on ended campaigns`}
          />
          {seller ? (
            <StatTile
              label="Profit"
              value={s.profit != null ? formatMoney(s.profit) : '—'}
              hint={
                s.profit != null
                  ? `${pct(s.marginPercent)} margin · costs cover ${pct(s.costCoverage)} of revenue`
                  : 'Add unit costs in Campaign performance'
              }
              tone={s.profit == null ? 'default' : num(s.profit) >= 0 ? 'good' : 'bad'}
            />
          ) : (
            <StatTile
              label="Stock held for group buys"
              value={s.unitsReservedHeld}
              hint={`${s.unitsCommittedHeld} committed · ${s.unitsAvailableHeld} available · ${s.liveCampaigns} live`}
            />
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <RevenueRealization summary={s} />
          <OutcomeTrend rows={data.daily || []} fileName={fileName('daily')} />
          <MoneyTrend rows={data.daily || []} />
          <ParticipantGrowth rows={data.daily || []} summary={s} />
          <DiscountBands rows={data.discountBands || []} fileName={fileName('discount-bands')} />
          <FailureReasons data={data} fileName={fileName('failure-reasons')} />
        </div>

        <PopularProducts rows={data.products || []} seller={seller} fileName={fileName('products')} />
        <CampaignPerformance
          rows={data.campaigns || []}
          seller={seller}
          fileName={fileName('campaigns')}
          onOpenCampaign={onOpenCampaign}
          onSaveUnitCost={onSaveUnitCost ? async (id, cost) => {
            await onSaveUnitCost(id, cost);
            await load();
          } : null}
        />
        {!seller && <SellerRanking rows={data.sellers || []} fileName={fileName('sellers')} />}
      </div>
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-800 text-rose-200 text-xs flex items-center justify-between gap-3">
      <span className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" /> {message}
      </span>
      <button type="button" onClick={onRetry} className="font-bold underline">
        Try again
      </button>
    </div>
  );
}

// ----- Charts --------------------------------------------------------------------------------

function RevenueRealization({ summary: s }) {
  const segments = [
    { label: 'Kept as revenue', value: s.revenue, color: SERIES[0] },
    { label: 'Refunded: group failed', value: s.lostToFailedGroups, color: SERIES[1] },
    { label: 'Refunded: member left', value: s.lostToLeaves, color: SERIES[2] },
    { label: 'Refunded: price dropped', value: s.priceDropRefunds, color: SERIES[3] },
    { label: 'Refunded: dispute', value: s.disputeRefunds, color: SERIES[4] },
  ];
  return (
    <ChartCard
      title="Expected vs actual revenue"
      subtitle={`${formatMoney(s.expectedRevenue)} paid at joining → ${formatMoney(s.revenue)} kept`}
      empty={num(s.expectedRevenue) <= 0}
      emptyText="No groups closed in this period."
    >
      <SplitBar segments={segments} total={s.expectedRevenue} />
    </ChartCard>
  );
}

function OutcomeTrend({ rows, fileName }) {
  const series = [
    { key: 'groupsSucceeded', label: 'Won', color: SERIES[0] },
    { key: 'groupsFailed', label: 'Failed or cancelled', color: SERIES[1] },
  ];
  const active = rows.some((r) => r.groupsStarted || r.groupsSucceeded || r.groupsFailed || r.participantsJoined);
  return (
    <ChartCard
      title="Group outcomes per day"
      subtitle="Groups that closed each day"
      legend={series}
      empty={!active}
      emptyText="No group activity in this period."
      table={{
        rows: rows.filter((r) => r.groupsStarted || r.groupsSucceeded || r.groupsFailed || r.participantsJoined),
        columns: [
          ['Date', (r) => shortDate(r.date)],
          ['Started', (r) => r.groupsStarted, 'right'],
          ['Won', (r) => r.groupsSucceeded, 'right'],
          ['Failed', (r) => r.groupsFailed, 'right'],
          ['Joins', (r) => r.participantsJoined, 'right'],
        ],
      }}
      actions={
        <ExportButton
          onClick={() =>
            downloadCsv(fileName, [
              ['Date', (r) => r.date],
              ['Groups started', (r) => r.groupsStarted],
              ['Groups won', (r) => r.groupsSucceeded],
              ['Groups failed or cancelled', (r) => r.groupsFailed],
              ['Participants joined', (r) => r.participantsJoined],
              ['Cumulative participants', (r) => r.cumulativeParticipants],
              ['Revenue', (r) => r.revenue],
              ['Refunds', (r) => r.refunds],
              ['Shopper savings', (r) => r.savings],
            ], rows)
          }
        />
      }
    >
      <StackedBars data={rows} xKey="date" series={series} xFormatter={shortDate} />
    </ChartCard>
  );
}

function MoneyTrend({ rows }) {
  const series = [
    { key: 'revenue', label: 'Revenue', color: SERIES[0] },
    { key: 'refunds', label: 'Refunds', color: SERIES[1] },
  ];
  const active = rows.some((r) => num(r.revenue) || num(r.refunds));
  return (
    <ChartCard
      title="Revenue and refunds per day"
      legend={series}
      empty={!active}
      emptyText="No money moved in this period."
      table={{
        rows: rows.filter((r) => num(r.revenue) || num(r.refunds)),
        columns: [
          ['Date', (r) => shortDate(r.date)],
          ['Revenue', (r) => formatMoney(r.revenue), 'right'],
          ['Refunds', (r) => formatMoney(r.refunds), 'right'],
          ['Shopper savings', (r) => formatMoney(r.savings), 'right'],
        ],
      }}
    >
      <Lines data={rows} xKey="date" series={series} xFormatter={shortDate} valueFormatter={compactMoney} />
    </ChartCard>
  );
}

function ParticipantGrowth({ rows, summary }) {
  const active = rows.some((r) => r.cumulativeParticipants);
  const last = rows[rows.length - 1];
  return (
    <ChartCard
      title="Participant growth"
      subtitle={last ? `${last.cumulativeParticipants} joins in the period · ${summary.activeParticipants} in open groups now` : null}
      empty={!active}
      emptyText="Nobody joined a group in this period."
      table={{
        rows: rows.filter((r) => r.participantsJoined),
        columns: [
          ['Date', (r) => shortDate(r.date)],
          ['Joined', (r) => r.participantsJoined, 'right'],
          ['Running total', (r) => r.cumulativeParticipants, 'right'],
        ],
      }}
    >
      <GrowthArea data={rows} xKey="date" dataKey="cumulativeParticipants" label="Total joins" xFormatter={shortDate} />
    </ChartCard>
  );
}

function DiscountBands({ rows, fileName }) {
  const active = rows.filter((r) => r.groupsClosed > 0);
  const best = rows.find((r) => r.best);
  return (
    <ChartCard
      title="Discount level vs success"
      subtitle={
        best
          ? `Best performer: ${best.label} — ${pct(best.successRate)} of ${best.groupsClosed} groups succeeded`
          : 'Grouped by each campaign’s biggest advertised discount. A band needs 3 closed groups to be ranked.'
      }
      empty={!active.length}
      emptyText="No groups closed in this period."
      table={{
        rows: active,
        columns: [
          ['Discount', (r) => r.label + (r.best ? ' ★' : '')],
          ['Campaigns', (r) => r.campaigns, 'right'],
          ['Groups', (r) => r.groupsClosed, 'right'],
          ['Success', (r) => pct(r.successRate), 'right'],
          ['Avg size', (r) => r.averageGroupSize, 'right'],
          ['Units', (r) => r.unitsSold, 'right'],
          ['Revenue', (r) => formatMoney(r.revenue), 'right'],
        ],
      }}
      actions={
        <ExportButton
          disabled={!active.length}
          onClick={() =>
            downloadCsv(fileName, [
              ['Discount band', (r) => r.label],
              ['Campaigns', (r) => r.campaigns],
              ['Groups closed', (r) => r.groupsClosed],
              ['Groups won', (r) => r.groupsSucceeded],
              ['Success rate %', (r) => r.successRate],
              ['Average group size', (r) => r.averageGroupSize],
              ['Units sold', (r) => r.unitsSold],
              ['Revenue', (r) => r.revenue],
              ['Shopper savings', (r) => r.customerSavings],
              ['Best performer', (r) => (r.best ? 'yes' : '')],
            ], rows)
          }
        />
      }
    >
      <RankedBars
        data={active.map((r) => ({ ...r, successRate: num(r.successRate) }))}
        labelKey="label"
        valueKey="successRate"
        label="Success rate"
        valueFormatter={(v) => `${v}%`}
        domainMax={100}
        highlight={best ? (r) => r.best : null}
      />
    </ChartCard>
  );
}

function FailureReasons({ data, fileName }) {
  const rows = data.failureReasons || [];
  return (
    <ChartCard
      title="Why groups fail"
      subtitle={rows.length ? plural(rows.reduce((a, r) => a + r.count, 0), 'group') + ' closed without orders' : null}
      empty={!rows.length}
      emptyText="No failed or cancelled groups in this period."
      table={{
        rows,
        columns: [
          ['Reason', (r) => r.label],
          ['Groups', (r) => r.count, 'right'],
          ['Share', (r) => pct(r.percent), 'right'],
          ['Refunded', (r) => formatMoney(r.refunded), 'right'],
        ],
      }}
      actions={
        <ExportButton
          disabled={!rows.length}
          onClick={() =>
            downloadCsv(fileName, [
              ['Reason', (r) => r.label],
              ['Groups', (r) => r.count],
              ['Share %', (r) => r.percent],
              ['Shoppers refunded', (r) => r.participantsAffected],
              ['Refunded', (r) => r.refunded],
            ], rows)
          }
        />
      }
    >
      <RankedBars data={rows} labelKey="label" valueKey="count" label="Groups" />
      {data.campaignCancellations?.length > 0 && (
        <div className="pt-3 border-t border-slate-800 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cancelled campaigns</p>
          {data.campaignCancellations.map((r) => (
            <p key={r.code} className="flex justify-between text-slate-300">
              <span>{r.label}</span>
              <span className="font-mono">{r.count}</span>
            </p>
          ))}
        </div>
      )}
    </ChartCard>
  );
}

// ----- Tables --------------------------------------------------------------------------------

function PopularProducts({ rows, seller, fileName }) {
  const top = rows.slice(0, 8);
  return (
    <ChartCard
      title="Popular products"
      subtitle="Ranked by units sold, then revenue and joins"
      empty={!rows.length}
      emptyText="No product activity in this period."
      table={{
        rows,
        columns: [
          ['Product', (r) => <ProductName row={r} seller={seller} />],
          ['Joins', (r) => r.joins, 'right'],
          ['Won / failed', (r) => `${r.groupsSucceeded} / ${r.groupsFailed}`, 'right'],
          ['Success', (r) => (r.groupsSucceeded + r.groupsFailed ? pct(r.successRate) : '—'), 'right'],
          ['Units', (r) => r.unitsSold, 'right'],
          ['Revenue', (r) => formatMoney(r.revenue), 'right'],
        ],
      }}
      actions={
        <ExportButton
          disabled={!rows.length}
          onClick={() =>
            downloadCsv(fileName, [
              ['Product', (r) => r.productName],
              ...(seller ? [] : [['Store', (r) => r.storeName]]),
              ['Campaigns', (r) => r.campaigns],
              ['Joins', (r) => r.joins],
              ['Groups won', (r) => r.groupsSucceeded],
              ['Groups failed', (r) => r.groupsFailed],
              ['Success rate %', (r) => r.successRate],
              ['Units sold', (r) => r.unitsSold],
              ['Revenue', (r) => r.revenue],
              ['Shopper savings', (r) => r.customerSavings],
            ], rows)
          }
        />
      }
    >
      <RankedBars
        data={top.map((r) => ({ ...r, name: truncate(r.productName, 18) }))}
        labelKey="name"
        valueKey={top.some((r) => r.unitsSold) ? 'unitsSold' : 'joins'}
        label={top.some((r) => r.unitsSold) ? 'Units sold' : 'Joins'}
      />
    </ChartCard>
  );
}

function ProductName({ row, seller }) {
  return (
    <span className="flex items-center gap-2">
      {row.productImageUrl ? (
        <img src={row.productImageUrl} alt="" className="w-7 h-7 rounded-lg object-cover border border-slate-800" />
      ) : (
        <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700" />
      )}
      <span>
        <span className="font-bold text-white block">{row.productName}</span>
        {!seller && <span className="text-[10px] text-slate-500">{row.storeName}</span>}
      </span>
    </span>
  );
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const truncate = (text, size) => (text && text.length > size ? `${text.slice(0, size - 1)}…` : text);

const CAMPAIGN_SORTS = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'successRate', label: 'Success rate' },
  { id: 'conversionRate', label: 'Conversion' },
  { id: 'joins', label: 'Joins' },
  { id: 'profit', label: 'Profit' },
];

function CampaignPerformance({ rows, seller, fileName, onOpenCampaign, onSaveUnitCost }) {
  const [sort, setSort] = useState('revenue');
  const [selected, setSelected] = useState([]);
  const sorted = useMemo(
    () => [...rows].sort((a, b) => num(b[sort] ?? -Infinity) - num(a[sort] ?? -Infinity)),
    [rows, sort],
  );
  const selectedRows = selected.map((id) => rows.find((r) => r.campaignId === id)).filter(Boolean);

  const toggle = (id) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : current.length >= COMPARE_LIMIT ? current : [...current, id],
    );

  const columns = [
    [
      'Compare',
      (r) => (
        <input
          type="checkbox"
          aria-label={`Compare ${r.title}`}
          checked={selected.includes(r.campaignId)}
          disabled={!selected.includes(r.campaignId) && selected.length >= COMPARE_LIMIT}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggle(r.campaignId)}
          className="accent-indigo-500"
        />
      ),
    ],
    [
      'Campaign',
      (r) => (
        <span>
          <span className="font-bold text-white block">{r.title}</span>
          <span className="text-[10px] text-slate-500">
            {seller ? r.productName : `${r.storeName} · ${r.productName}`} · up to {pct(r.maxDiscountPercent)} off
          </span>
        </span>
      ),
    ],
    ['Status', (r) => <CampaignStatusBadge status={r.status} />],
    ['Joins', (r) => r.joins, 'right'],
    ['Won / failed', (r) => `${r.groupsSucceeded} / ${r.groupsFailed}`, 'right'],
    ['Success', (r) => (r.groupsSucceeded + r.groupsFailed ? pct(r.successRate) : '—'), 'right'],
    ['Conversion', (r) => (r.closedGroupMembers ? pct(r.conversionRate) : '—'), 'right'],
    ['Avg size', (r) => (r.groupsSucceeded ? r.averageGroupSize : '—'), 'right'],
    ['Units', (r) => `${r.unitsSold}`, 'right'],
    ['Expected', (r) => formatMoney(r.expectedRevenue), 'right'],
    ['Revenue', (r) => <span className="text-white">{formatMoney(r.revenue)}</span>, 'right'],
  ];
  if (seller) {
    columns.push(
      ['Unit cost', (r) => <UnitCostCell row={r} onSave={onSaveUnitCost} />, 'right'],
      [
        'Profit',
        (r) =>
          r.profit != null ? (
            <span className={num(r.profit) >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
              {formatMoney(r.profit)}
              {r.marginPercent != null && <span className="text-slate-500"> · {pct(r.marginPercent)}</span>}
            </span>
          ) : (
            '—'
          ),
        'right',
      ],
    );
  }

  return (
    <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-sm font-extrabold text-white">Campaign performance</h3>
          <p className="text-[11px] text-slate-500">
            Tick up to {COMPARE_LIMIT} campaigns to compare them side by side.
            {seller && ' Unit costs are private to you and power profit and margin.'}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="flex items-center gap-1.5 text-slate-400">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
            >
              {CAMPAIGN_SORTS.filter((o) => seller || o.id !== 'profit').map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <ExportButton disabled={!rows.length} onClick={() => exportCampaigns(fileName, rows, seller)} />
        </div>
      </div>
      {rows.length ? (
        <DataTable
          columns={columns}
          rows={sorted}
          rowKey={(r) => r.campaignId}
          onRowClick={onOpenCampaign ? (r) => onOpenCampaign(r.campaignId) : undefined}
          maxHeight="max-h-[28rem]"
        />
      ) : (
        <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
          No launched campaigns with activity in this period.
        </div>
      )}
      {selectedRows.length > 0 && (
        <CampaignComparison rows={selectedRows} seller={seller} onClear={() => setSelected([])} onRemove={toggle} />
      )}
    </section>
  );
}

function UnitCostCell({ row, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!onSave) return row.unitCost != null ? formatMoney(row.unitCost) : '—';

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setValue(row.unitCost != null ? String(row.unitCost) : '');
          setError('');
          setEditing(true);
        }}
        className="inline-flex items-center gap-1 text-slate-300 hover:text-white"
      >
        {row.unitCost != null ? formatMoney(row.unitCost) : <span className="text-indigo-300">Add</span>}
        <Pencil className="w-3 h-3" />
      </button>
    );
  }

  const save = async () => {
    const trimmed = value.trim();
    const cost = trimmed === '' ? null : Number(trimmed);
    if (cost != null && (!Number.isFinite(cost) || cost < 0)) {
      setError('Enter a positive amount');
      return;
    }
    setSaving(true);
    try {
      await onSave(row.campaignId, cost);
      setEditing(false);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
      <span className="inline-flex items-center gap-1">
        <input
          autoFocus
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setEditing(false);
          }}
          placeholder="Blank clears"
          aria-label="Unit cost"
          className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-slate-100"
        />
        <button type="button" onClick={save} disabled={saving} aria-label="Save unit cost" className="text-emerald-300">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button type="button" onClick={() => setEditing(false)} aria-label="Cancel" className="text-slate-400">
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
      {error && <span className="text-[10px] text-rose-300">{error}</span>}
    </span>
  );
}

const COMPARE_METRICS = [
  { key: 'successRate', label: 'Success rate', format: pct, max: 100 },
  { key: 'conversionRate', label: 'Conversion rate', format: pct, max: 100 },
  { key: 'revenue', label: 'Revenue', format: formatMoney },
  { key: 'averageGroupSize', label: 'Average group size', format: (v) => v },
  { key: 'joins', label: 'Joins', format: (v) => v },
  { key: 'sellThroughRate', label: 'Sell-through (lifetime)', format: pct, max: 100 },
];

/** Small multiples: one bar row per metric, each campaign keeps its colour across every metric. */
function CampaignComparison({ rows, seller, onClear, onRemove }) {
  const metrics = seller ? [...COMPARE_METRICS, { key: 'profit', label: 'Profit', format: formatMoney }] : COMPARE_METRICS;
  return (
    <div className="pt-4 border-t border-slate-800 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {rows.map((r, i) => (
            <span key={r.campaignId} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-slate-700 text-slate-200">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: SERIES[i] }} /> {r.title}
              <button type="button" onClick={() => onRemove(r.campaignId)} aria-label={`Remove ${r.title}`} className="text-slate-500 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <button type="button" onClick={onClear} className="text-slate-400 hover:text-white font-bold">
          Clear comparison
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {metrics.map((metric) => {
          const values = rows.map((r) => num(r[metric.key]));
          const max = metric.max || Math.max(...values, 0);
          return (
            <div key={metric.key} className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{metric.label}</p>
              {rows.map((r, i) => (
                <div key={r.campaignId} className="flex items-center gap-2">
                  <div className="flex-1 h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${max > 0 ? Math.max(0, (num(r[metric.key]) / max) * 100) : 0}%`,
                        background: SERIES[i],
                      }}
                    />
                  </div>
                  <span className="w-20 text-right font-mono tabular-nums text-slate-200">
                    {r[metric.key] == null ? '—' : metric.format(r[metric.key])}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {rows.map((r, i) => (
          <div key={r.campaignId} className="space-y-1.5">
            <p className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: SERIES[i] }} /> Price ladder reach
            </p>
            {(r.tiers || []).map((tier) => (
              <p key={tier.minParticipants} className="flex justify-between text-slate-400">
                <span>
                  {tier.minParticipants}+ people · {formatMoney(tier.unitPrice)} ({pct(tier.discountPercent)} off)
                  {tier.mostReached && <Trophy className="inline w-3 h-3 ml-1 text-amber-300" aria-label="Most reached" />}
                </span>
                <span className="font-mono text-slate-200">{tier.groupsEndedHere} won</span>
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SellerRanking({ rows, fileName }) {
  const [sort, setSort] = useState('rank');
  const sorted = useMemo(
    () => (sort === 'rank' ? rows : [...rows].sort((a, b) => num(b[sort]) - num(a[sort]))),
    [rows, sort],
  );
  return (
    <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-sm font-extrabold text-white">Seller performance ranking</h3>
          <p className="text-[11px] text-slate-500">Ranked by revenue, then success rate and buyers</p>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="flex items-center gap-1.5 text-slate-400">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
            >
              <option value="rank">Rank</option>
              <option value="successRate">Success rate</option>
              <option value="conversionRate">Conversion</option>
              <option value="buyers">Buyers</option>
              <option value="customerSavings">Shopper savings</option>
            </select>
          </label>
          <ExportButton
            disabled={!rows.length}
            onClick={() =>
              downloadCsv(fileName, [
                ['Rank', (r) => r.rank],
                ['Store', (r) => r.storeName],
                ['Campaigns', (r) => r.campaigns],
                ['Live campaigns', (r) => r.liveCampaigns],
                ['Groups won', (r) => r.groupsSucceeded],
                ['Groups failed', (r) => r.groupsFailed],
                ['Success rate %', (r) => r.successRate],
                ['Conversion rate %', (r) => r.conversionRate],
                ['Buyers', (r) => r.buyers],
                ['Average group size', (r) => r.averageGroupSize],
                ['Units sold', (r) => r.unitsSold],
                ['Revenue', (r) => r.revenue],
                ['Refunds', (r) => r.refunds],
                ['Shopper savings', (r) => r.customerSavings],
              ], rows)
            }
          />
        </div>
      </div>
      {rows.length ? (
        <DataTable
          rowKey={(r) => r.storeId}
          rows={sorted}
          columns={[
            ['#', (r) => <span className={r.rank <= 3 ? 'font-black text-amber-300' : 'text-slate-500'}>{r.rank}</span>],
            ['Store', (r) => <span className="font-bold text-white">{r.storeName}</span>],
            ['Campaigns', (r) => `${r.campaigns} (${r.liveCampaigns} live)`, 'right'],
            ['Won / failed', (r) => `${r.groupsSucceeded} / ${r.groupsFailed}`, 'right'],
            ['Success', (r) => (r.groupsSucceeded + r.groupsFailed ? pct(r.successRate) : '—'), 'right'],
            ['Conversion', (r) => pct(r.conversionRate), 'right'],
            ['Buyers', (r) => r.buyers, 'right'],
            ['Avg size', (r) => r.averageGroupSize, 'right'],
            ['Units', (r) => r.unitsSold, 'right'],
            ['Revenue', (r) => <span className="text-white">{formatMoney(r.revenue)}</span>, 'right'],
            ['Savings', (r) => formatMoney(r.customerSavings), 'right'],
          ]}
        />
      ) : (
        <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
          No seller activity in this period.
        </div>
      )}
    </section>
  );
}

// ----- CSV -----------------------------------------------------------------------------------

function exportCampaigns(fileName, rows, seller) {
  downloadCsv(fileName, [
    ['Campaign', (r) => r.title],
    ['Product', (r) => r.productName],
    ...(seller ? [] : [['Store', (r) => r.storeName]]),
    ['Status', (r) => r.status],
    ['Base price', (r) => r.basePrice],
    ['Lowest price', (r) => r.lowestPrice],
    ['Max discount %', (r) => r.maxDiscountPercent],
    ['Groups started', (r) => r.groupsStarted],
    ['Groups won', (r) => r.groupsSucceeded],
    ['Groups failed', (r) => r.groupsFailed],
    ['Success rate %', (r) => r.successRate],
    ['Joins', (r) => r.joins],
    ['Members in closed groups', (r) => r.closedGroupMembers],
    ['Members with orders', (r) => r.convertedMembers],
    ['Conversion rate %', (r) => r.conversionRate],
    ['Average group size', (r) => r.averageGroupSize],
    ['Units sold', (r) => r.unitsSold],
    ['Units reserved', (r) => r.reservedQuantity],
    ['Sell-through % (lifetime)', (r) => r.sellThroughRate],
    ['Expected revenue', (r) => r.expectedRevenue],
    ['Revenue', (r) => r.revenue],
    ['Refunds', (r) => r.refunds],
    ['Shopper savings', (r) => r.customerSavings],
    ...(seller
      ? [
          ['Unit cost', (r) => r.unitCost],
          ['Cost', (r) => r.cost],
          ['Profit', (r) => r.profit],
          ['Margin %', (r) => r.marginPercent],
        ]
      : []),
    ['Most common failure', (r) => r.topFailureReason],
  ], rows);
}

function exportSummary(data, fileName, seller) {
  const s = data.summary;
  const period = WINDOWS.find((w) => w.id === data.days)?.label;
  const rows = [
    ['Scope', seller ? `Store: ${data.storeName}` : 'Platform'],
    ['Period', period],
    ['Generated at', data.generatedAt],
    ['Groups started', s.groupsStarted],
    ['Groups closed', s.groupsClosed],
    ['Groups won', s.groupsSucceeded],
    ['Groups failed', s.groupsFailed],
    ['Groups cancelled', s.groupsCancelled],
    ['Success rate %', s.successRate],
    ['Failure rate %', s.failureRate],
    ['Participants joined', s.participantsJoined],
    ['Unique shoppers', s.uniqueCustomers],
    ['Repeat shoppers', s.repeatCustomers],
    ['Joins via invites', s.inviteJoins],
    ['Members in closed groups', s.closedGroupMembers],
    ['Members with orders', s.convertedMembers],
    ['Conversion rate %', s.conversionRate],
    ['Average successful group size', s.averageGroupSize],
    ['Average closed group size', s.averageClosedGroupSize],
    ['Units sold', s.unitsSold],
    ['Expected revenue', s.expectedRevenue],
    ['Revenue', s.revenue],
    ['Revenue realised %', s.realizationRate],
    ['Refunded: group failed', s.lostToFailedGroups],
    ['Refunded: member left', s.lostToLeaves],
    ['Refunded: price dropped', s.priceDropRefunds],
    ['Refunded: dispute', s.disputeRefunds],
    ['Refunds total', s.refunds],
    ['Regular price value', s.regularPriceValue],
    ['Shopper savings', s.customerSavings],
    ['Average discount %', s.averageDiscountPercent],
    ...(seller && s.profit != null
      ? [
          ['Cost', s.cost],
          ['Profit', s.profit],
          ['Margin %', s.marginPercent],
          ['Revenue with unit cost %', s.costCoverage],
        ]
      : []),
    ['Live campaigns (now)', s.liveCampaigns],
    ['Open groups (now)', s.openGroups],
    ['Members in open groups (now)', s.activeParticipants],
    ['Units reserved (now)', s.unitsReservedHeld],
    ['Units committed (now)', s.unitsCommittedHeld],
    ['Units available (now)', s.unitsAvailableHeld],
    ['Sell-through on ended campaigns %', s.sellThroughRate],
    ...Object.entries(data.campaignOutcomes || {}).map(([status, count]) => [`Campaigns ended ${status}`, count]),
  ];
  downloadCsv(fileName, [
    ['Metric', (r) => r[0]],
    ['Value', (r) => r[1]],
  ], rows);
}
