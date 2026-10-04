import React, { useMemo } from 'react';
import { formatMoney } from '../../groupbuy/format';
import { Panel, StatTile, StatusPill } from './featureUi';
import { statusMeta, num } from './featureConfigs';

/**
 * The numbers behind the feature, all derived from the same rows the rest of the tab uses, so the
 * overview can never drift out of step with the record list.
 */
export default function OverviewPanel({ config, metrics, onNavigate }) {
  const { all, live, byStatus, liveCount, total, totalMoney, totalParticipation } = metrics;

  const statusBreakdown = useMemo(
    () => [...byStatus.entries()].sort((a, b) => b[1] - a[1]),
    [byStatus],
  );

  const attention = useMemo(() => {
    const items = [];
    if (metrics.overdue.length) {
      items.push({
        tone: 'red',
        text: `${metrics.overdue.length} ${config.nounPlural} past their ${config.deadlineLabel.toLowerCase()} but still open`,
        go: () => onNavigate('monitoring'),
      });
    }
    if (metrics.closingSoon.length) {
      items.push({
        tone: 'amber',
        text: `${metrics.closingSoon.length} ${config.nounPlural} closing within 48 hours`,
        go: () => onNavigate('monitoring'),
      });
    }
    if (metrics.stalled.length) {
      items.push({
        tone: 'amber',
        text: `${metrics.stalled.length} live ${config.nounPlural} with no participation yet`,
        go: () => onNavigate('monitoring'),
      });
    }
    if (metrics.nearGoal.length) {
      items.push({
        tone: 'blue',
        text: `${metrics.nearGoal.length} live ${config.nounPlural} at 80% or more of their goal`,
        go: () => onNavigate('monitoring'),
      });
    }
    return items;
  }, [metrics, config, onNavigate]);

  return (
    <div className="space-y-5 text-xs">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label={`Live ${config.nounPlural}`} value={liveCount} tone="good" />
        <StatTile label={`All ${config.nounPlural}`} value={total} />
        <StatTile
          label="Value of live"
          value={formatMoney(totalMoney)}
          hint="Sum of each live unit price"
        />
        <StatTile
          label="Participating parties"
          value={totalParticipation}
          hint="Sellers, buyers and bidders, as this feature counts them"
        />
      </div>

      <Panel title="Needs attention" icon={attention.length ? undefined : undefined}>
        {attention.length === 0 ? (
          <p className="text-slate-500">
            Nothing needs intervention. No deadlines have been missed and no live {config.noun} is
            stalled.
          </p>
        ) : (
          <ul className="space-y-2">
            {attention.map((item) => (
              <li key={item.text}>
                <button
                  type="button"
                  onClick={item.go}
                  className={`w-full text-left px-3 py-2 rounded-xl border ${
                    item.tone === 'red'
                      ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                      : item.tone === 'amber'
                        ? 'bg-amber-950/40 border-amber-700 text-amber-200'
                        : 'bg-sky-950/40 border-sky-800 text-sky-200'
                  }`}
                >
                  {item.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title={`Where every ${config.noun} stands`}>
          {statusBreakdown.length === 0 ? (
            <p className="text-slate-500">No {config.nounPlural} yet.</p>
          ) : (
            <table className="w-full text-left">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="pb-1">Status</th>
                  <th className="pb-1 text-right">Count</th>
                  <th className="pb-1 text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {statusBreakdown.map(([status, count]) => (
                  <tr key={status} className="border-b border-slate-900">
                    <td className="py-1.5">
                      <StatusPill meta={statusMeta(status)} />
                    </td>
                    <td className="py-1.5 text-right font-bold text-white">{count}</td>
                    <td className="py-1.5 text-right text-slate-400">
                      {total ? Math.round((count / total) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title={`Top live ${config.nounPlural} by participation`}>
          {live.length === 0 ? (
            <p className="text-slate-500">Nothing is live right now.</p>
          ) : (
            <ul className="space-y-2">
              {[...live]
                .sort((a, b) => num(config.participation(b)) - num(config.participation(a)))
                .slice(0, 8)
                .map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3">
                    <span className="text-slate-300 truncate">{config.title(row)}</span>
                    <span className="text-slate-500 shrink-0">{num(config.participation(row))}</span>
                  </li>
                ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
