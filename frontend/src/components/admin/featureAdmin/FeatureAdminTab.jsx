import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CalendarClock, ClipboardList, FileWarning, Radio, ScrollText } from 'lucide-react';
import { apiErrorMessage } from '../../../api/groupBuyApi';
import { Banner, EmptyState, Loading, Panel } from './featureUi';
import { deriveMetrics } from './featureConfigs';
import OverviewPanel from './OverviewPanel';
import RecordsPanel from './RecordsPanel';
import MonitoringPanel from './MonitoringPanel';
import ReportsPanel from './ReportsPanel';
import DisputesPanel from './DisputesPanel';
import DeliveryPanel from '../groupbuy/DeliveryPanel';
import AuditTrailPanel from '../groupbuy/AuditTrailPanel';

/**
 * Audit log coverage today: only group buy writes feature-scoped entries, via
 * GroupBuyAuditLogger, which prefixes every action with "GROUP_BUY_". Nothing else in the backend
 * logs moderation actions for these five features, so their audit tab shows the platform entries
 * that do exist and says plainly that feature actions are not recorded.
 */
const AUDIT_NOTE =
  'Moderation actions on this feature are not yet written to the audit log. The entries below are the ' +
  'platform-wide admin and order actions that are recorded.';

const AUDIT_RESOURCES = [
  { id: 'ALL', label: 'All' },
  { id: 'ORDER', label: 'Orders & delivery' },
  { id: 'USER', label: 'User administration' },
  { id: 'GROUP_BUY_CAMPAIGN', label: 'Group buy campaigns' },
  { id: 'GROUP_BUY_GROUP', label: 'Group buy groups' },
  { id: 'GROUP_BUY_DISPUTE', label: 'Group buy disputes' },
  { id: 'GROUP_BUY_FLAG', label: 'Group buy fraud flags' },
];

const TABS = [
  { id: 'overview', label: 'Overview', Icon: BarChart3 },
  { id: 'records', label: 'Records', Icon: ClipboardList },
  { id: 'monitoring', label: 'Monitoring', Icon: Radio },
  { id: 'exceptions', label: 'Disputes & exceptions', Icon: FileWarning },
  { id: 'delivery', label: 'Delivery dates', Icon: CalendarClock },
  { id: 'reports', label: 'Analytics & reports', Icon: BarChart3 },
  { id: 'audit', label: 'Audit log', Icon: ScrollText },
];

/** Shown where a feature genuinely has no dispute model, instead of an empty queue. */
function NoDisputeModel({ label }) {
  return (
    <EmptyState>
      <p className="font-bold text-slate-300">{label} has no dispute model.</p>
      <p className="mt-1 max-w-lg mx-auto">
        Disputes are raised against a reservation that was created from a wholesale offer, so the dispute queue
        belongs to the Wholesale tab. For {label}, monitor the Exceptions signals in the Monitoring tab instead:
        entries past their deadline, entries with no participation, and any priced above the listed product.
      </p>
    </EmptyState>
  );
}

export default function FeatureAdminTab({ config }) {
  const [tab, setTab] = useState('overview');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await config.load());
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, `Could not load ${config.nounPlural}`));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    load();
  }, [load]);

  const metrics = useMemo(() => deriveMetrics(config, rows), [config, rows]);

  const deliveryScopeOptions = useMemo(
    () => [{ id: config.orderType, label: `${config.label} orders` }, { id: 'ALL', label: 'All orders' }],
    [config],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-white">{config.label}</h2>
          <p className="text-[11px] text-slate-500 max-w-2xl">{config.source}</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          {metrics.overdue.length} overdue · {metrics.closingSoon.length} closing soon
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-slate-800">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-3 py-2 text-[11px] font-bold flex items-center gap-1.5 border-b-2 -mb-px ${
              tab === id
                ? 'border-indigo-400 text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </nav>

      <Banner error={error} onClear={() => setError('')} />

      {loading ? (
        <Loading label={`Loading ${config.nounPlural}…`} />
      ) : (
        <>
          {tab === 'overview' && (
            <OverviewPanel config={config} metrics={metrics} onNavigate={setTab} />
          )}

          {tab === 'records' && (
            <RecordsPanel
              config={config}
              rows={metrics.all}
              selectedId={selectedId}
              onSelect={(row) => setSelectedId(row.id)}
            />
          )}

          {tab === 'monitoring' && <MonitoringPanel config={config} metrics={metrics} />}

          {tab === 'exceptions' &&
            (config.hasDisputes ? (
              <DisputesPanel api={config.disputeApi} featureLabel={config.label} />
            ) : (
              <div className="space-y-4">
                <NoDisputeModel label={config.label} />
                <Panel title="Exception signals available for this feature">
                  <MonitoringPanel config={config} metrics={metrics} />
                </Panel>
              </div>
            ))}

          {tab === 'delivery' && (
            <DeliveryPanel initialScope={config.orderType} scopeOptions={deliveryScopeOptions} showSettings={false} />
          )}

          {tab === 'reports' && <ReportsPanel config={config} metrics={metrics} />}

          {tab === 'audit' && (
            <div className="space-y-3">
              <p className="text-[11px] text-amber-200 bg-amber-950/40 border border-amber-800 rounded-xl px-3 py-2">
                {AUDIT_NOTE}
              </p>
              <AuditTrailPanel actionPrefix="" resourceFilters={AUDIT_RESOURCES} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
