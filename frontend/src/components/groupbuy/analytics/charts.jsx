import React, { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend as RechartsLegend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar as RechartsRadar,
  RadarChart,
  ResponsiveContainer,
  Scatter as RechartsScatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Download, Table2 } from 'lucide-react';
import { formatMoney, formatPercent } from '../format';

/**
 * Categorical slots, in fixed order, stepped for the dark surface. Validated as a set:
 * adjacent pairs pass colour-vision-deficiency separation, and the first three pass for every pair.
 * Green/red was rejected for won/failed because the pair fails under protanopia.
 */
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
export const MUTED_MARK = '#475569';

const INK_MUTED = '#94a3b8';
const GRID = '#1e293b';
const AXIS = '#334155';

export const compactMoney = (value) => {
  const n = Number(value ?? 0);
  if (Math.abs(n) >= 1000000) return `৳${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `৳${(n / 1000).toFixed(1)}k`;
  return `৳${Math.round(n)}`;
};

export const shortDate = (iso) => {
  if (!iso) return '';
  const [year, month, day] = String(iso).split('-').map(Number);
  return new Date(year, month - 1, day || 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const shortMonth = (yearMonth) => {
  const [year, month] = String(yearMonth).split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
};

const axisProps = {
  stroke: AXIS,
  tick: { fill: INK_MUTED, fontSize: 10 },
  tickLine: false,
  axisLine: { stroke: AXIS },
};

const yAxisProps = { ...axisProps, axisLine: false, width: 48 };

/**
 * Axis label for a period key that may be an ISO date or an already-formatted label.
 *
 * <p>The analytics rollup returns pre-formatted buckets such as "Sep 27", while series built from
 * live rows use `YYYY-MM-DD`. `shortDate` only understands the latter and yields "Invalid Date" for
 * the former, so anything that is not an ISO date is passed through untouched.
 */
export const periodSafeLabel = (value) => {
  const raw = String(value ?? '');
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(raw)) return raw;
  return shortDate(raw);
};

/** Hover tooltip: a swatch carries identity, values stay in text ink. */
function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/95 px-3 py-2 text-[11px] shadow-xl space-y-1">
      <p className="font-bold text-slate-100">{labelFormatter ? labelFormatter(label, payload) : label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="flex items-center justify-between gap-4 text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: item.color || item.payload?.fill }} />
            {item.name}
          </span>
          <span className="font-mono text-slate-100">{valueFormatter ? valueFormatter(item.value, item) : item.value}</span>
        </p>
      ))}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
      {items.map(({ label, color }) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} /> {label}
        </span>
      ))}
    </div>
  );
}

export function ExportButton({ onClick, disabled, label = 'CSV' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-[11px] font-bold flex items-center gap-1 disabled:opacity-40"
    >
      <Download className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

/**
 * Card around one chart with a chart/table switch, so every value is readable without hovering.
 * `table` is { columns: [[header, (row) => value, align?]], rows }.
 */
export function ChartCard({ title, subtitle, legend, table, actions, empty, emptyText, children, className = '' }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={`glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 text-xs ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-sm font-extrabold text-white">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1.5">
          {actions}
          {table && !empty && (
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              aria-pressed={showTable}
              className="px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-[11px] font-bold flex items-center gap-1"
            >
              {showTable ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
              {showTable ? 'Chart' : 'Table'}
            </button>
          )}
        </div>
      </div>
      {empty ? (
        <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">{emptyText}</div>
      ) : showTable ? (
        <DataTable columns={table.columns} rows={table.rows} />
      ) : (
        <>
          {legend && <Legend items={legend} />}
          {children}
        </>
      )}
    </section>
  );
}

export function DataTable({ columns, rows, rowKey, onRowClick, maxHeight = 'max-h-80' }) {
  return (
    <div className={`overflow-auto ${maxHeight}`}>
      <table className="w-full text-left text-xs text-slate-300">
        <thead className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800 sticky top-0 bg-slate-950">
          <tr>
            {columns.map(([header, , align]) => (
              <th key={header} className={`py-2 pr-3 whitespace-nowrap ${align === 'right' ? 'text-right' : ''}`}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey ? rowKey(row) : index}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-slate-900 hover:bg-slate-900/40 ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map(([header, get, align]) => (
                <td
                  key={header}
                  className={`py-2 pr-3 ${align === 'right' ? 'text-right font-mono tabular-nums whitespace-nowrap' : ''}`}
                >
                  {get(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const chartMargin = { top: 8, right: 8, bottom: 0, left: 0 };

/** Stacked bars per category; `series` is [{ key, label, color }]. */
export function StackedBars({ data, xKey, series, height = 220, xFormatter, valueFormatter }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={chartMargin} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} {...axisProps} tickFormatter={xFormatter} minTickGap={16} />
          <YAxis {...yAxisProps} allowDecimals={false} tickFormatter={valueFormatter} />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.08)' }}
            content={<ChartTooltip labelFormatter={xFormatter} valueFormatter={valueFormatter} />}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="stack"
              fill={s.color}
              stroke="#0f172a"
              strokeWidth={1}
              maxBarSize={28}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** One or more lines sharing a single value axis. */
export function Lines({ data, xKey, series, height = 220, xFormatter, valueFormatter }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={chartMargin}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} {...axisProps} tickFormatter={xFormatter} minTickGap={16} />
          <YAxis {...yAxisProps} tickFormatter={valueFormatter} />
          <Tooltip
            cursor={{ stroke: INK_MUTED, strokeWidth: 1 }}
            content={<ChartTooltip labelFormatter={xFormatter} valueFormatter={valueFormatter} />}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="linear"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: '#0f172a', strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Single-series area for cumulative growth. */
export function GrowthArea({ data, xKey, dataKey, label, height = 220, xFormatter, valueFormatter }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={chartMargin}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} {...axisProps} tickFormatter={xFormatter} minTickGap={16} />
          <YAxis {...yAxisProps} allowDecimals={false} tickFormatter={valueFormatter} />
          <Tooltip
            cursor={{ stroke: INK_MUTED, strokeWidth: 1 }}
            content={<ChartTooltip labelFormatter={xFormatter} valueFormatter={valueFormatter} />}
          />
          <Area
            type="linear"
            dataKey={dataKey}
            name={label}
            stroke={SERIES[0]}
            strokeWidth={2}
            fill={SERIES[0]}
            fillOpacity={0.15}
            activeDot={{ r: 4, stroke: '#0f172a', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal single-series bars; rows where `highlight(row)` is true keep the series colour, the rest are muted. */
export function RankedBars({ data, labelKey, valueKey, label, height, valueFormatter, highlight, domainMax }) {
  const chartHeight = height || Math.max(120, data.length * 34 + 24);
  return (
    <div style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" {...axisProps} allowDecimals={false} tickFormatter={valueFormatter} domain={[0, domainMax || 'auto']} />
          <YAxis type="category" dataKey={labelKey} {...axisProps} axisLine={false} width={120} interval={0} />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.08)' }}
            content={<ChartTooltip valueFormatter={valueFormatter} />}
          />
          <Bar dataKey={valueKey} name={label} radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.map((row) => (
              <Cell key={row[labelKey]} fill={!highlight || highlight(row) ? SERIES[0] : MUTED_MARK} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Part-to-whole bar: one horizontal strip split into segments, with a labelled list underneath. */
export function SplitBar({ segments, total, valueFormatter = formatMoney }) {
  const visible = segments.filter((s) => Number(s.value) > 0);
  const sum = Number(total) || visible.reduce((acc, s) => acc + Number(s.value), 0);
  if (sum <= 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex h-5 w-full overflow-hidden rounded-md gap-[2px]" role="img" aria-label="Breakdown">
        {visible.map((s) => (
          <div
            key={s.label}
            title={`${s.label}: ${valueFormatter(s.value)} (${formatPercent((Number(s.value) / sum) * 100)})`}
            style={{ width: `${(Number(s.value) / sum) * 100}%`, background: s.color }}
          />
        ))}
      </div>
      <ul className="space-y-1.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-2 text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}
            </span>
            <span className="font-mono tabular-nums text-slate-100">
              {valueFormatter(s.value)}{' '}
              <span className="text-slate-500">{formatPercent((Number(s.value) / sum) * 100)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Revenue as a filled area with order count as a line on a second axis.
 *
 * <p>The two series are counted in different units - taka versus orders - so they cannot share a
 * value axis without one of them flattening into a straight line. A right-hand axis keeps both
 * readable, which is the whole point of drawing them together.
 */
export function RevenueOrdersTrend({ data, xKey, revenueKey, ordersKey, height = 280, xFormatter }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={chartMargin}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.45} />
              <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} {...axisProps} tickFormatter={xFormatter} minTickGap={18} />
          <YAxis
            {...yAxisProps}
            tickFormatter={compactMoney}
            width={54}
            // Revenue is always the larger number, so the shared scale is anchored to it and
            // the order axis is scaled to the visible revenue range.
            domain={[0, (max) => (typeof max === 'number' ? max * 1.15 : 'auto')]}
          />
          <YAxis yAxisId="orders" orientation="right" {...axisProps} axisLine={false} width={34} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: INK_MUTED, strokeWidth: 1 }}
            content={
              <ChartTooltip
                labelFormatter={xFormatter}
                valueFormatter={(value, item) =>
                  item.dataKey === ordersKey ? `${value} orders` : compactMoney(value)
                }
              />
            }
          />
          <Area
            type="monotone"
            dataKey={revenueKey}
            name="Revenue"
            stroke={SERIES[0]}
            strokeWidth={2}
            fill="url(#revenueFill)"
            yAxisId={0}
            activeDot={{ r: 4, stroke: '#0f172a', strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey={ordersKey}
            name="Orders"
            stroke={SERIES[3]}
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
            yAxisId="orders"
            activeDot={{ r: 4, stroke: '#0f172a', strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut with the total in the middle and a clickable-free legend beside it. */
export function Donut({ data, nameKey, valueKey, height = 240, centerLabel, centerValue, valueFormatter }) {
  const total = data.reduce((acc, row) => acc + Number(row[valueKey] || 0), 0);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] items-center gap-4">
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey={valueKey}
              nameKey={nameKey}
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={2}
              stroke="#0f172a"
              strokeWidth={2}
            >
              {data.map((row, i) => (
                <Cell key={row[nameKey]} fill={SERIES[i % SERIES.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1.5">
        {data.map((row, i) => (
          <li key={row[nameKey]} className="flex items-center justify-between gap-2 text-slate-300">
            <span className="flex items-center gap-1.5 truncate">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: SERIES[i % SERIES.length] }} />
              {row[nameKey]}
            </span>
            <span className="font-mono tabular-nums text-slate-100 whitespace-nowrap">
              {valueFormatter ? valueFormatter(row[valueKey]) : row[valueKey]}
              <span className="text-slate-500 ml-1">
                {formatPercent(total > 0 ? (Number(row[valueKey] || 0) / total) * 100 : 0)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {centerValue != null && (
        <p className="sr-only">{centerLabel}: {centerValue}</p>
      )}
    </div>
  );
}

/** Single-series vertical columns, one per category. Used where categories read better upright. */
export function Columns({ data, xKey, valueKey, label, height = 240, xFormatter, valueFormatter, color = SERIES[0] }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={chartMargin} barCategoryGap={8}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} {...axisProps} tickFormatter={xFormatter} minTickGap={8} />
          <YAxis {...yAxisProps} allowDecimals={false} tickFormatter={valueFormatter} />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.08)' }}
            content={<ChartTooltip labelFormatter={xFormatter} valueFormatter={valueFormatter} />}
          />
          <Bar dataKey={valueKey} name={label} fill={color} radius={[4, 4, 0, 0]} maxBarSize={46} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Average order value as a column per day.
 *
 * <p>Deliberately not a total-revenue chart: AOV exposes the days where a single large order
 * distorted a revenue total, which a summed series hides.
 */
export function AverageOrderValueBars({ data, xKey, valueKey, height = 240, xFormatter }) {
  const rows = data.map((row) => ({ ...row, [valueKey]: Number(row[valueKey] || 0) }));
  return (
    <Columns
      data={rows}
      xKey={xKey}
      valueKey={valueKey}
      label="Average order value"
      height={height}
      xFormatter={xFormatter}
      valueFormatter={compactMoney}
      color={SERIES[1]}
    />
  );
}

/** Rating histogram: how many reviews sit at each star value. */
export function RatingHistogram({ data, xKey, valueKey, height = 220 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={chartMargin} barCategoryGap={10}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} {...axisProps} />
          <YAxis {...yAxisProps} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.08)' }}
            content={<ChartTooltip />}
          />
          {/* Star count is a quality measure, not a magnitude to exaggerate, so every bar keeps
              the same colour and the axis is anchored at zero. */}
          <Bar dataKey={valueKey} name="Reviews" radius={[4, 4, 0, 0]} maxBarSize={54} fill={SERIES[2]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export { RechartsLegend };

/**
 * Scatter: relationship between two measures per entity.
 *
 * <p>Used where the question is correlation rather than trend - for example whether campaigns
 * that discount hardest also convert best, which a bar chart cannot show.
 */
export function Scatter({
  data,
  xKey,
  yKey,
  nameKey,
  xLabel,
  yLabel,
  height = 280,
  xFormatter,
  yFormatter,
  color = SERIES[0],
  domainMax,
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ ...chartMargin, right: 16, bottom: 12 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis
            type="number"
            dataKey={xKey}
            {...axisProps}
            tickFormatter={xFormatter}
            domain={[0, domainMax || 'auto']}
            label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -8, fill: INK_MUTED, fontSize: 10 } : undefined}
          />
          <YAxis
            type="number"
            dataKey={yKey}
            {...axisProps}
            tickFormatter={yFormatter}
            width={54}
            label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fill: INK_MUTED, fontSize: 10 } : undefined}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3', stroke: INK_MUTED }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload;
              return (
                <div className="rounded-xl border border-slate-700 bg-slate-950/95 px-3 py-2 text-[11px] shadow-xl space-y-1">
                  <p className="font-bold text-slate-100">{point?.[nameKey] ?? '—'}</p>
                  {xFormatter && <p className="text-slate-300">{xLabel}: <span className="font-mono">{xFormatter(point?.[xKey])}</span></p>}
                  {yFormatter && <p className="text-slate-300">{yLabel}: <span className="font-mono">{yFormatter(point?.[yKey])}</span></p>}
                </div>
              );
            }}
          />
          <RechartsScatter data={data} fill={color} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Radar: one shape per entity across a shared set of normalised dimensions.
 *
 * <p>Values are expected to be on a comparable 0-100 scale; the caller normalises, because
 * silently rescaling here would hide which dimension is actually small.
 */
export function Radar({ data, angleKey, series, height = 300, domainMax = 100 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke={GRID} />
          <PolarAngleAxis dataKey={angleKey} tick={{ fill: INK_MUTED, fontSize: 10 }} />
          <PolarRadiusAxis
            angle={90}
            domain={[0, domainMax]}
            tick={{ fill: INK_MUTED, fontSize: 9 }}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltip />} />
          {series.map((s) => (
            <RechartsRadar
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.18}
              strokeWidth={2}
            />
          ))}
          <RechartsLegend wrapperStyle={{ fontSize: 10, color: INK_MUTED }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
