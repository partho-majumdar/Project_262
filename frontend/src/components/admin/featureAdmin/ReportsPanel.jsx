import React, { useMemo } from 'react';
import { Donut, RankedBars, SERIES } from '../../groupbuy/analytics/charts';
import { Panel, StatTile } from './featureUi';
import { statusMeta, num } from './featureConfigs';

const money = (value) => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
};

/**
 * Charts built from the same rows as the rest of the tab. Nothing here is fetched separately, so a
 * report can never contradict the record list.
 */
export default function ReportsPanel({ config, metrics }) {
  const { all, byStatus, live } = metrics;

  const statusSegments = useMemo(
    () => [...byStatus.entries()].map(([status, value]) => ({
      label: statusMeta(status)[0],
      value,
      color: SERIES[[...byStatus.keys()].indexOf(status) % SERIES.length],
    })),
    [byStatus],
  );

  const bySeller = useMemo(() => {
    const totals = new Map();
    for (const row of all) {
      const key = (row.sellerStoreName ?? row.leaderName ?? 'Unknown').trim() || 'Unknown';
      const current = totals.get(key) ?? { value: 0, count: 0 };
      current.value += num(config.unitPrice(row));
      current.count += 1;
      totals.set(key, current);
    }
    return [...totals.entries()]
      .map(([name, entry]) => ({ name, value: Math.round(entry.value), count: entry.count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [all, config]);

  const byMonth = useMemo(() => {
    const totals = new Map();
    for (const row of all) {
      const at = row.createdAt ?? config.deadline(row);
      if (!at) continue;
      const key = String(at).slice(0, 7);
      totals.set(key, (totals.get(key) || 0) + 1);
    }
    return [...totals.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, value]) => ({ name, value }));
  }, [all, config]);

  if (all.length === 0) {
    return <p className="text-xs text-slate-400">No {config.nounPlural} yet, so there is nothing to report.</p>;
  }

  return (
    <div className="space-y-4 text-xs">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Records" value={all.length} />
        <StatTile label="Live now" value={live.length} tone="good" />
        <StatTile
          label="Median participation"
          value={(() => {
            const values = all.map((row) => num(config.participation(row))).sort((a, b) => a - b);
            if (!values.length) return 0;
            return values[Math.floor(values.length / 2)];
          })()}
        />
        <StatTile
          label="Distinct counterparties"
          value={new Set(all.map((row) => row.sellerStoreName ?? row.leaderName ?? 'Unknown')).size}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Status mix">
          <Donut
            data={statusSegments}
            nameKey="label"
            valueKey="value"
            height={240}
          />
        </Panel>

        <Panel title="Counterparty value">
          {bySeller.length === 0 ? (
            <p className="text-slate-500">No counterparties recorded.</p>
          ) : (
            <RankedBars data={bySeller} labelKey="name" valueKey="value" height={240} />
          )}
        </Panel>
      </div>

      {byMonth.length > 1 && (
        <Panel title="Created per month">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {byMonth.map((row) => (
              <div key={row.name}>
                <StatTile label={row.name} value={row.value} />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-3">
            Total value on record {money(metrics.totalMoney)}.
          </p>
        </Panel>
      )}
    </div>
  );
}
