import React, { useMemo, useState } from 'react';
import { formatDateTime, formatMoney } from '../../groupbuy/format';
import { EmptyState, FilterChips, Panel, StatusPill, tableClass, theadClass, rowClass } from './featureUi';
import { statusMeta, num, LIVE_STATUSES, SETTLED_STATUSES } from './featureConfigs';

function progressOf(config, row) {
  try {
    return config.progress(row);
  } catch {
    return { label: 'Progress', done: 0, total: 0, percent: 0 };
  }
}

/**
 * The searchable record list. The same table serves all five features; only the columns and the
 * progress label come from the feature config.
 */
export default function RecordsPanel({ config, rows, onSelect, selectedId }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const filters = useMemo(() => {
    const hasStatus = rows.some((row) => Boolean(row.status));
    return [
      { id: 'all', label: 'All', test: null },
      hasStatus && { id: 'live', label: 'Live', test: (row) => LIVE_STATUSES.includes(row.status) },
      hasStatus && { id: 'settled', label: 'Settled', test: (row) => !LIVE_STATUSES.includes(row.status) },
    ].filter(Boolean);
  }, [rows]);

  const visible = useMemo(() => {
    const active = filters.find((f) => f.id === filter) ?? filters[0];
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (active?.test && !active.test(row)) return false;
      if (!needle) return true;
      return config.title(row).toLowerCase().includes(needle)
        || (row.status ?? '').toLowerCase().includes(needle);
    });
  }, [rows, filter, filters, query, config]);

  if (rows.length === 0) return <EmptyState>No {config.nounPlural} have been created yet.</EmptyState>;

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips options={filters} value={filter} onChange={setFilter} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Filter ${config.nounPlural}…`}
          className="flex-1 min-w-[200px] bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-100"
        />
      </div>

      <Panel>
        {visible.length === 0 ? (
          <EmptyState>No {config.nounPlural} match this filter.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr>
                  <th className="py-1.5 pr-3">{config.label}</th>
                  <th className="py-1.5 pr-3">Status</th>
                  <th className="py-1.5 pr-3">Progress</th>
                  <th className="py-1.5 pr-3 text-right">Price</th>
                  <th className="py-1.5 pr-3 text-right">Participating</th>
                  <th className="py-1.5 pr-3">{config.deadlineLabel}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const progress = progressOf(config, row);
                  const deadline = config.deadline(row);
                  const overdue = deadline
                    && new Date(deadline).getTime() < Date.now()
                    && !SETTLED_STATUSES.includes(row.status);
                  return (
                    <tr
                      key={row.id}
                      onClick={() => onSelect?.(row)}
                      className={`${rowClass} cursor-pointer ${selectedId === row.id ? 'bg-slate-900/70' : ''}`}
                    >
                      <td className="py-2 pr-3 text-slate-200">{config.title(row)}</td>
                      <td className="py-2 pr-3">
                        <StatusPill meta={statusMeta(row.status)} />
                      </td>
                      <td className="py-2 pr-3 w-40">
                        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-indigo-500"
                            style={{ width: `${Math.max(0, Math.min(100, num(progress.percent)))}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {progress.done}/{progress.total} {progress.label.toLowerCase()}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right text-slate-300">{formatMoney(config.unitPrice(row))}</td>
                      <td className="py-2 pr-3 text-right text-slate-300">{num(config.participation(row))}</td>
                      <td className="py-2 pr-3">
                        <span className={overdue ? 'text-rose-300' : 'text-slate-400'}>
                          {deadline ? formatDateTime(deadline) : '—'}
                          {overdue ? ' (overdue)' : ''}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
