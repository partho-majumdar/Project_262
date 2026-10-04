import React from 'react';
import { formatDateTime, formatMoney } from '../../groupbuy/format';
import { EmptyState, Panel, StatusPill } from './featureUi';
import { statusMeta, num } from './featureConfigs';

function Group({ title, tone, rows, config, emptyText, renderExtra }) {
  const border = tone === 'red'
    ? 'border-rose-800 bg-rose-950/30'
    : tone === 'amber'
      ? 'border-amber-800/70 bg-amber-950/25'
      : 'border-slate-800 bg-slate-900/40';
  const heading = tone === 'red' ? 'text-rose-200' : tone === 'amber' ? 'text-amber-200' : 'text-slate-200';

  return (
    <Panel className={border}>
      <h3 className={`text-xs font-black ${heading} mb-2`}>
        {title} <span className="text-slate-500 font-normal">({rows.length})</span>
      </h3>
      {rows.length === 0 ? (
        <p className="text-[11px] text-slate-500">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="text-[11px] leading-relaxed">
              <div className="flex items-start justify-between gap-2">
                <span className="text-slate-200">{config.title(row)}</span>
                <StatusPill meta={statusMeta(row.status)} />
              </div>
              <div className="text-slate-500">
                {config.deadline(row) ? `${config.deadlineLabel}: ${formatDateTime(config.deadline(row))}` : 'No deadline set'}
                {' · '}
                {num(config.participation(row))} participating
                {renderExtra ? ` · ${renderExtra(row)}` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * Live health of the feature: what has run past its deadline, what is about to close, and what is
 * going nowhere. All three are computed from the real rows rather than stored flags.
 */
export default function MonitoringPanel({ config, metrics }) {
  const listPriceApplies = typeof config.listPrice === 'function';
  const priceOutliers = listPriceApplies
    ? metrics.live.filter((row) => {
      const price = num(config.unitPrice(row));
      const listed = num(config.listPrice(row));
      return price > 0 && listed > 0 && price > listed;
    })
    : [];

  return (
    <div className="space-y-4 text-xs">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Group
          title="Past deadline but still open"
          tone="red"
          rows={metrics.overdue}
          config={config}
          emptyText={`No ${config.noun} has overstayed its deadline.`}
        />
        <Group
          title="Closing within 48 hours"
          tone="amber"
          rows={metrics.closingSoon}
          config={config}
          emptyText="Nothing closes in the next two days."
        />
        <Group
          title="Live with no participation"
          tone="amber"
          rows={metrics.stalled}
          config={config}
          emptyText="Every live entry has at least one participant."
          renderExtra={(row) => `unit price ${formatMoney(config.unitPrice(row))}`}
        />
        <Group
          title="Priced above the listed product"
          tone="red"
          rows={priceOutliers}
          config={config}
          emptyText={listPriceApplies
            ? 'No live entry is priced above its product\'s listed price.'
            : `Not applicable to ${config.label}: a rising price is expected here, so it is not treated as an anomaly.`}
          renderExtra={(row) => `unit ${formatMoney(config.unitPrice(row))} vs listed ${formatMoney(config.listPrice(row))}`}
        />
      </div>

      {metrics.all.length === 0 ? (
        <EmptyState>There is nothing to monitor yet.</EmptyState>
      ) : (
        <Panel title="Goal progress across every live entry">
          <ul className="space-y-2">
            {metrics.live.map((row) => {
              let progress = { done: 0, total: 0, percent: 0, label: 'Progress' };
              try {
                progress = config.progress(row);
              } catch {
                /* a malformed row should not blank the panel */
              }
              return (
                <li key={row.id}>
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="text-slate-300 truncate">{config.title(row)}</span>
                    <span className="text-slate-500 shrink-0">
                      {progress.done}/{progress.total}
                    </span>
                  </div>
                  <div className="h-1.5 mt-1 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500"
                      style={{ width: `${Math.max(0, Math.min(100, num(progress.percent)))}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}
