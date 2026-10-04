import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, Search } from 'lucide-react';
import { adminGroupBuyApi, apiErrorMessage } from '../../../api/groupBuyApi';
import { formatDateTime } from '../../groupbuy/format';
import { Banner, EmptyState, FilterChips, Loading, Pill, downloadCsv, rowClass, tableClass, theadClass } from './adminUi';

const RESOURCE_FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'GROUP_BUY_CAMPAIGN', label: 'Campaigns' },
  { id: 'GROUP_BUY_GROUP', label: 'Groups & members' },
  { id: 'GROUP_BUY_DISPUTE', label: 'Disputes' },
  { id: 'GROUP_BUY_FLAG', label: 'Fraud flags' },
];

const ACTION_TONES = {
  APPROVE: 'green',
  REJECT: 'red',
  FORCE_CLOSE: 'amber',
  ADMIN_CANCEL: 'red',
  SELLER_CANCEL: 'red',
  GROUP_CANCEL: 'red',
  MEMBER_REMOVE: 'red',
  DISPUTE_RESOLVE: 'green',
  DISPUTE_REJECT: 'slate',
  FLAG_CONFIRM: 'red',
  FLAG_DISMISS: 'slate',
};

export default function AuditTrailPanel({ actionPrefix = 'GROUP_BUY_', resourceFilters = RESOURCE_FILTERS }) {
  const [page, setPage] = useState({ content: [], totalElements: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resource, setResource] = useState('ALL');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPage((await adminGroupBuyApi.getAuditLogs(0, 200)) || { content: [] });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load the audit log'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The platform search matches loosely, so keep only entries for the feature being viewed
  const entries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (page.content || [])
      .filter((log) => !actionPrefix || log.action?.startsWith(actionPrefix))
      .filter((log) => resource === 'ALL' || log.resource === resource)
      .filter((log) => !needle || [log.userEmail, log.action, log.details].some((v) => v?.toLowerCase().includes(needle)));
  }, [page, resource, query, actionPrefix]);

  const exportCsv = () =>
    downloadCsv('group-buy-audit-log.csv', [
      ['Time', (l) => l.timestamp],
      ['Actor', (l) => l.userEmail],
      ['Action', (l) => l.action],
      ['Resource', (l) => l.resource],
      ['Details', (l) => l.details],
      ['IP address', (l) => l.ipAddress],
    ], entries);

  return (
    <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4 text-xs">
      <p className="text-slate-400">
        Every publication, closure, cancellation, member removal, dispute decision and fraud review, plus seller submissions
        and shopper reports. Entries are also part of the platform audit log in the Security Center.
      </p>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <FilterChips options={resourceFilters} value={resource} onChange={setResource} />
        <div className="flex gap-2">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Actor, action or details"
              className="w-56 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 pl-9 text-slate-100"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          </div>
          <button
            type="button"
            onClick={load}
            className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={entries.length === 0}
            className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white font-bold flex items-center gap-1.5 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>
      <Banner error={error} onClear={() => setError('')} />

      {loading && entries.length === 0 ? (
        <Loading label="Loading audit log…" />
      ) : entries.length === 0 ? (
        <EmptyState>No group buy audit entries yet.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead className={theadClass}>
              <tr>
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Actor</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Details</th>
                <th className="py-2 pr-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((log) => {
                const action = log.action.replace(/^GROUP_BUY_/, '');
                return (
                  <tr key={log.id} className={rowClass}>
                    <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                    <td className="py-2 pr-3 text-slate-200">{log.userEmail}</td>
                    <td className="py-2 pr-3">
                      <Pill tone={ACTION_TONES[action] || 'blue'}>{action.replace(/_/g, ' ')}</Pill>
                    </td>
                    <td className="py-2 pr-3 text-slate-300 max-w-xl">{log.details}</td>
                    <td className="py-2 pr-3 font-mono text-slate-500">{log.ipAddress}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
