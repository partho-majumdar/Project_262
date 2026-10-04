import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Boxes,
  Coins,
  MapPin,
  Package,
  Percent,
  RefreshCw,
  ShoppingBasket,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react';
import axiosClient from '../../../api/axiosClient';
import {
  AverageOrderValueBars,
  ChartCard,
  Donut,
  ExportButton,
  GrowthArea,
  Lines,
  RankedBars,
  RevenueOrdersTrend,
  SERIES,
  SplitBar,
  compactMoney,
} from '../../groupbuy/analytics/charts';
import { downloadCsv } from '../../groupbuy/csv';
import { formatMoney, formatPercent } from '../../groupbuy/format';

/**
 * Bucket width and the range choices valid for it.
 *
 * <p>Day buckets keep a busy fortnight legible; month buckets keep a long view affordable. The
 * counts are per-granularity because they mean different things: 12 months is a year of trend,
 * while 12 days is barely a fortnight. The server clamps to the same ranges regardless.
 */
const GRANULARITIES = [
  { id: 'DAY', label: 'Day', buckets: [30, 90, 180] },
  { id: 'WEEK', label: 'Week', buckets: [13, 26, 52] },
  { id: 'MONTH', label: 'Month', buckets: [12, 24, 36] },
];

const granularityOf = (id) => GRANULARITIES.find((option) => option.id === id) || GRANULARITIES[2];

const num = (value) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const rowsOf = (source) => (Array.isArray(source) ? source : []);

const money = (value) => formatMoney(num(value));
const moneyAxis = (value) => compactMoney(value);
const countAxis = (value) => num(value).toLocaleString();
const share = (value, total) => (total > 0 ? (num(value) / num(total)) * 100 : 0);
const cap = (text) => (text ? text[0].toUpperCase() + text.slice(1) : text);

/**
 * Describes movement against the preceding window.
 *
 * <p>The server sends null rather than 0 when the previous window had no trade at all, because a
 * growth rate off an empty base is not zero growth - it is an absent comparison. Rendering "0.0%"
 * there would quietly claim the marketplace held flat, which the data does not support.
 */
function growthHint(value) {
  if (value === null || value === undefined) return 'No comparable prior period';
  const n = num(value);
  return `${n > 0 ? '+' : ''}${formatPercent(n)} vs previous period`;
}

function growthTone(value) {
  if (value === null || value === undefined) return 'text-slate-500';
  return num(value) >= 0 ? 'text-emerald-400' : 'text-rose-400';
}

function StatTile({ icon: Icon, label, value, hint, hintClass = 'text-slate-500', accent = 'text-rose-400' }) {
  return (
    <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{label}</span>
        <Icon className={`w-4 h-4 ${accent} shrink-0`} />
      </div>
      <p className="text-xl font-black text-white leading-tight">{value}</p>
      <p className={`text-[10px] ${hintClass}`}>{hint}</p>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 grid place-items-center">
          <Icon className="w-4 h-4 text-rose-400" />
        </span>
        <div>
          <h3 className="text-sm font-extrabold text-white">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * The marketplace GMV surface.
 *
 * <p>Everything here is one server rollup over the orders table rather than a client-side
 * aggregation of list endpoints: the bucketed series, its cumulative and average-value derivatives,
 * and every breakdown are all derived from the same range, so the headline total always equals
 * the sum of the chart under it.
 *
 * <p>GMV is the order value placed, excluding cancelled orders. The value cancelled orders carried
 * is shown alongside rather than dropped, and refunded orders stay inside GMV - a return follows a
 * placed sale, so removing it would make the series move for orders that were never cancelled.
 */
export default function MarketplaceGmvAnalytics() {
  const [granularity, setGranularity] = useState('MONTH');
  const [buckets, setBuckets] = useState(12);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosClient.get('/admin/analytics/sales-performance', {
        params: { granularity, buckets },
      });
      setReport(res?.data ?? res ?? null);
    } catch (err) {
      setReport(null);
      setError({ message: err?.message || 'The sales performance report could not be loaded.', status: err?.statusCode });
    } finally {
      setLoading(false);
    }
  }, [granularity, buckets]);

  useEffect(() => {
    load();
  }, [load]);

  /** Switching bucket width resets the range, because the old count is meaningless in the new unit. */
  const chooseGranularity = (id) => {
    setGranularity(id);
    setBuckets(granularityOf(id).buckets[0]);
  };

  const m = useMemo(() => {
    if (!report) return null;

    const series = rowsOf(report.series).map((row) => ({
      period: row.period,
      label: row.label || row.period,
      gmv: num(row.gmv),
      orders: num(row.orderCount),
      units: num(row.unitCount),
      buyers: num(row.buyerCount),
      aov: num(row.averageOrderValue),
      discount: num(row.discountAmount),
    }));

    let running = 0;
    const cumulative = series.map((row) => ({ label: row.label, gmv: (running += row.gmv) }));

    const gmv = num(report.gmv);
    const statusMix = rowsOf(report.orderStatusMix);
    // The state mix counts cancelled orders too, so it is the count of everything placed.
    const ordersPlaced = statusMix.reduce((sum, row) => sum + num(row.orderCount), 0);

    const categories = rowsOf(report.categorySales).map((row) => ({
      name: row.categoryName || 'Uncategorized',
      value: num(row.totalRevenue),
    }));
    const products = rowsOf(report.topProducts).map((row) => ({
      name: row.productName || row.sku || 'Unnamed',
      value: num(row.totalRevenue),
    }));
    const cities = rowsOf(report.topCities).map((row) => ({ name: row.city, value: num(row.gmv) }));

    const unit = report.bucketUnit || 'months';
    const bucketCount = num(report.bucketCount) || series.length;

    return {
      gmv,
      orderCount: num(report.orderCount),
      ordersPlaced,
      unitCount: num(report.unitCount),
      buyerCount: num(report.buyerCount),
      aov: num(report.averageOrderValue),
      netValue: num(report.netMerchandiseValue),
      discount: num(report.discountAmount),
      tax: num(report.taxAmount),
      shipping: num(report.shippingAmount),
      cancelledOrders: num(report.cancelledOrderCount),
      cancelledAmount: num(report.cancelledAmount),
      refundedOrders: num(report.refundedOrderCount),
      refundedAmount: num(report.refundedAmount),
      previousGmv: num(report.previousPeriodGmv),
      previousOrders: num(report.previousPeriodOrderCount),
      gmvGrowth: report.gmvGrowthPercent ?? null,
      orderGrowth: report.orderGrowthPercent ?? null,
      peak: report.peakPeriod ?? null,
      bucketProgress: num(report.lastBucketProgressPercent),
      lifetimeGmv: num(report.lifetimeGmv),
      lifetimeOrders: num(report.lifetimeOrderCount),
      unit,
      bucketCount,
      /** e.g. "last 30 days" - the server is the authority on the unit, not the client. */
      rangeLabel: `last ${bucketCount} ${unit}`,
      /** Singular noun for the active bucket, for wording like "peak week". */
      noun: { DAY: 'day', WEEK: 'week', MONTH: 'month' }[report.granularity] || 'month',
      series,
      cumulative,
      categories,
      products,
      cities,
      features: rowsOf(report.gmvByFeature).map((row) => ({
        name: row.label || row.feature,
        value: num(row.gmv),
        orders: num(row.orderCount),
        share: num(row.percentage),
      })),
      payments: rowsOf(report.gmvByPaymentMethod).map((row) => ({
        name: row.label || row.name,
        value: num(row.gmv),
        orders: num(row.orderCount),
      })),
      states: statusMix.map((row) => ({ name: row.label || row.status, value: num(row.orderCount) })),
      hasTrading: gmv > 0 || num(report.orderCount) > 0 || ordersPlaced > 0,
    };
  }, [report]);

  const exportSeries = useCallback(() => {
    if (!m) return;
    downloadCsv(
      `groupmart-gmv-${m.bucketCount}-${m.unit}.csv`,
      [
        ['Period', (r) => r.label],
        ['GMV', (r) => r.gmv.toFixed(2)],
        ['Orders', (r) => r.orders],
        ['Units', (r) => r.units],
        ['Buyers', (r) => r.buyers],
        ['Average order value', (r) => r.aov.toFixed(2)],
        ['Discounts', (r) => r.discount.toFixed(2)],
      ],
      m.series,
    );
  }, [m]);

  if (loading && !m) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin text-rose-400" />
        <p className="text-sm font-medium">Rolling up marketplace sales…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-black uppercase text-rose-400 tracking-wider">Marketplace sales performance (GMV)</h3>
          <p className="text-[11px] text-slate-500">
            Gross merchandise value: order value placed, excluding cancelled orders
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1" role="group" aria-label="Bucket width">
            {GRANULARITIES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => chooseGranularity(option.id)}
                aria-pressed={granularity === option.id}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition ${
                  granularity === option.id ? 'bg-rose-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="Range">
            {granularityOf(granularity).buckets.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setBuckets(count)}
                aria-pressed={buckets === count}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition ${
                  buckets === count ? 'bg-slate-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                {count}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={load}
            className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-800 bg-amber-950/30 p-3 text-amber-200 text-[11px] flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            {error.message}
            {error.status === 404 && (
              <span className="block mt-1 text-amber-300/90">
                This endpoint is missing on the running server, so it was started from a build made
                before the GMV report existed. Restart the backend to pick it up.
              </span>
            )}
          </span>
        </div>
      )}

      {m && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile
              icon={Coins}
              label="GMV"
              value={money(m.gmv)}
              hint={growthHint(m.gmvGrowth)}
              hintClass={growthTone(m.gmvGrowth)}
              accent="text-emerald-400"
            />
            <StatTile
              icon={Package}
              label="Orders"
              value={countAxis(m.orderCount)}
              hint={growthHint(m.orderGrowth)}
              hintClass={growthTone(m.orderGrowth)}
            />
            <StatTile
              icon={Banknote}
              label="Average order"
              value={money(m.aov)}
              hint={`${money(m.previousGmv)} in the previous window`}
              accent="text-amber-400"
            />
            <StatTile
              icon={Users}
              label="Buyers"
              value={countAxis(m.buyerCount)}
              hint={`${countAxis(m.ordersPlaced)} orders placed in total`}
              accent="text-sky-400"
            />
            <StatTile
              icon={ShoppingBasket}
              label="Units sold"
              value={countAxis(m.unitCount)}
              hint={`${formatPercent(share(m.unitCount, m.ordersPlaced))} units per order`}
              accent="text-violet-400"
            />
            <StatTile
              icon={TrendingUp}
              label={`Peak ${m.noun}`}
              value={m.peak ? money(m.peak.gmv) : '—'}
              hint={m.peak ? `${m.peak.label} in this range` : 'No trading in this range'}
              accent="text-rose-400"
            />
            <StatTile
              icon={Percent}
              label="Discounts given"
              value={money(m.discount)}
              hint={`${formatPercent(share(m.discount, m.netValue))} of merchandise value`}
              accent="text-amber-400"
            />
            <StatTile
              icon={Store}
              label="Lifetime GMV"
              value={money(m.lifetimeGmv)}
              hint={`${countAxis(m.lifetimeOrders)} orders all time`}
              accent="text-emerald-400"
            />
          </div>

          {!m.hasTrading && (
            <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl text-xs">
              No orders have been placed in this range yet, so there is nothing to plot. The series
              below will fill in as orders arrive.
            </div>
          )}

          <SectionTitle
            icon={TrendingUp}
            title="Value over time"
            subtitle={`One point per ${m.noun}, covering the ${m.rangeLabel}`}
          >
            <ExportButton onClick={exportSeries} disabled={m.series.length === 0} />
          </SectionTitle>

          <ChartCard
            title="GMV and order volume"
            subtitle="Value as a filled area, order count on the right-hand axis"
            legend={[
              { label: 'GMV', color: SERIES[0] },
              { label: 'Orders (right axis)', color: SERIES[3] },
            ]}
            empty={!m.hasTrading}
            emptyText="No orders in this range."
            table={{
              columns: [
                [cap(m.noun), (row) => row.label],
                ['GMV', (row) => money(row.gmv), 'right'],
                ['Orders', (row) => row.orders.toLocaleString(), 'right'],
                ['Units', (row) => row.units.toLocaleString(), 'right'],
                ['Buyers', (row) => row.buyers.toLocaleString(), 'right'],
                ['Average order', (row) => money(row.aov), 'right'],
              ],
              rows: m.series,
              rowKey: (row) => row.period,
            }}
            >
              <RevenueOrdersTrend
                data={m.series}
                xKey="label"
                revenueKey="gmv"
                ordersKey="orders"
                height={290}
              />
              {m.bucketProgress > 0 && m.bucketProgress < 100 && (
                <p className="text-[10px] text-slate-500 pt-1">
                  The last point ({m.series[m.series.length - 1]?.label}) is still filling —{' '}
                  {formatPercent(m.bucketProgress)} of that {m.noun} has elapsed, so it will read lower
                  than the completed {m.noun}s beside it.
                </p>
              )}
            </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Cumulative GMV"
              subtitle="Running total across the window"
              empty={!m.hasTrading}
              emptyText="No orders in this range."
              table={{
                columns: [
                  [cap(m.noun), (row) => row.label],
                  ['Cumulative GMV', (row) => money(row.gmv), 'right'],
                ],
                rows: m.cumulative,
                rowKey: (row) => row.label,
              }}
            >
              <GrowthArea data={m.cumulative} xKey="label" dataKey="gmv" label="Cumulative GMV" height={250} valueFormatter={moneyAxis} />
            </ChartCard>

            <ChartCard
              title={`Average order value per ${m.noun}`}
              subtitle="Whether volume growth came from bigger baskets"
              empty={!m.hasTrading}
              emptyText="No orders in this range."
              table={{
                columns: [
                  [cap(m.noun), (row) => row.label],
                  ['Average order value', (row) => money(row.aov), 'right'],
                ],
                rows: m.series,
                rowKey: (row) => row.period,
              }}
            >
              <AverageOrderValueBars data={m.series} xKey="label" valueKey="aov" height={250} />
            </ChartCard>
          </div>

          <ChartCard
            title={`Units and buyers per ${m.noun}`}
            subtitle="Volume against the number of distinct people doing the buying"
            legend={[
              { label: 'Units sold', color: SERIES[0] },
              { label: 'Buyers', color: SERIES[1] },
            ]}
            empty={!m.hasTrading}
            emptyText="No orders in this range."
            table={{
              columns: [
                [cap(m.noun), (row) => row.label],
                ['Units', (row) => row.units.toLocaleString(), 'right'],
                ['Buyers', (row) => row.buyers.toLocaleString(), 'right'],
              ],
              rows: m.series,
              rowKey: (row) => row.period,
            }}
          >
            <Lines
              data={m.series}
              xKey="label"
              series={[
                { key: 'units', label: 'Units sold', color: SERIES[0] },
                { key: 'buyers', label: 'Buyers', color: SERIES[1] },
              ]}
              height={250}
              valueFormatter={countAxis}
            />
          </ChartCard>

          <SectionTitle icon={Boxes} title="Where the value comes from" subtitle="What is driving the GMV" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="GMV by purchase mechanism"
              subtitle="Regular baskets against every collective feature"
              empty={m.features.length === 0}
              emptyText="No orders in this range."
              table={{
                columns: [
                  ['Mechanism', (row) => row.name],
                  ['GMV', (row) => money(row.value), 'right'],
                  ['Share', (row) => formatPercent(row.share), 'right'],
                  ['Orders', (row) => row.orders.toLocaleString(), 'right'],
                ],
                rows: m.features,
                rowKey: (row) => row.name,
              }}
            >
              <Donut data={m.features.map((r) => ({ name: r.name, value: r.value }))} nameKey="name" valueKey="value" valueFormatter={moneyAxis} />
            </ChartCard>

            <ChartCard
              title="GMV by category"
              subtitle="Share of merchandise value, which excludes tax and shipping"
              empty={m.categories.length === 0}
              emptyText="No sold lines in this window."
              table={{
                columns: [
                  ['Category', (row) => row.name],
                  ['GMV', (row) => money(row.value), 'right'],
                  ['Share', (row) => formatPercent(share(row.value, m.categories.reduce((s, c) => s + c.value, 0))), 'right'],
                ],
                rows: m.categories,
                rowKey: (row) => row.name,
              }}
            >
              <Donut data={m.categories} nameKey="name" valueKey="value" valueFormatter={moneyAxis} />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Top products by GMV"
              subtitle="The listings carrying the most value in this window"
              empty={m.products.length === 0}
              emptyText="No sold lines in this window."
              table={{
                columns: [
                  ['Product', (row) => row.name],
                  ['GMV', (row) => money(row.value), 'right'],
                ],
                rows: m.products,
                rowKey: (row) => row.name,
              }}
            >
              <RankedBars data={m.products} labelKey="name" valueKey="value" label="GMV" valueFormatter={moneyAxis} />
            </ChartCard>

            <ChartCard
              title="GMV by delivery city"
              subtitle="Where the demand physically sits"
              empty={m.cities.length === 0}
              emptyText="No shipped orders in this window."
              table={{
                columns: [
                  ['City', (row) => row.name],
                  ['GMV', (row) => money(row.value), 'right'],
                ],
                rows: m.cities,
                rowKey: (row) => row.name,
              }}
            >
              <RankedBars data={m.cities} labelKey="name" valueKey="value" label="GMV" valueFormatter={moneyAxis} />
            </ChartCard>
          </div>

          <SectionTitle icon={ShoppingBasket} title="Order shape" subtitle="Where every order sits and how it was paid for" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ChartCard
              title="Order states"
              subtitle="Every order placed, cancelled ones included"
              empty={m.states.length === 0}
              emptyText="No orders in this range."
              table={{
                columns: [
                  ['State', (row) => row.name],
                  ['Orders', (row) => row.value.toLocaleString(), 'right'],
                ],
                rows: m.states,
                rowKey: (row) => row.name,
              }}
            >
              <Donut data={m.states} nameKey="name" valueKey="value" height={230} />
            </ChartCard>

            <ChartCard
              title="GMV by payment method"
              subtitle="Which gateway orders complete on"
              empty={m.payments.length === 0}
              emptyText="No orders in this range."
              table={{
                columns: [
                  ['Method', (row) => row.name],
                  ['GMV', (row) => money(row.value), 'right'],
                  ['Orders', (row) => row.orders.toLocaleString(), 'right'],
                ],
                rows: m.payments,
                rowKey: (row) => row.name,
              }}
            >
              <SplitBar
                segments={m.payments.map((row, i) => ({ label: row.name, value: row.value, color: SERIES[i % SERIES.length] }))}
                total={m.gmv}
                valueFormatter={money}
              />
            </ChartCard>

            <ChartCard
              title="Value outside GMV"
              subtitle="What cancellation and returns removed"
              empty={!m.cancelledOrders && !m.refundedOrders}
              emptyText="Nothing was cancelled or refunded in this window."
            >
              <div className="space-y-3 pt-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] text-slate-400">Cancelled orders</span>
                  <span className="font-mono text-slate-100">
                    {countAxis(m.cancelledOrders)} · {money(m.cancelledAmount)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] text-slate-400">Refunded orders</span>
                  <span className="font-mono text-slate-100">
                    {countAxis(m.refundedOrders)} · {money(m.refundedAmount)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Cancelled orders are left out of GMV entirely. Refunded orders stay in it, because a
                  return follows a placed sale — the series would otherwise move for orders that were
                  never cancelled.
                </p>
              </div>
            </ChartCard>
          </div>

          <SectionTitle icon={Banknote} title="What the GMV is made of" subtitle="Order value decomposed" />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile icon={Boxes} label="Merchandise value" value={money(m.netValue)} hint="Sum of line subtotals" accent="text-sky-400" />
            <StatTile icon={Percent} label="Discounts" value={money(m.discount)} hint="Already deducted from order value" accent="text-amber-400" />
            <StatTile icon={Banknote} label="Tax" value={money(m.tax)} hint="Collected on orders" accent="text-violet-400" />
            <StatTile icon={MapPin} label="Shipping" value={money(m.shipping)} hint="Charged to customers" accent="text-emerald-400" />
          </div>
        </>
      )}
    </div>
  );
}
