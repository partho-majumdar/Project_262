import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  FileText,
  Gavel,
  LayoutGrid,
  Layers,
  RefreshCw,
  ShieldAlert,
  Truck,
} from 'lucide-react';
import { adminGroupBuyApi, apiErrorMessage } from '../../../api/groupBuyApi';
import { formatDateTime, formatMoney, formatPercent } from '../../groupbuy/format';
import CampaignStatusBadge from '../../seller/groupbuy/CampaignStatusBadge';
import StatTile from '../../seller/groupbuy/StatTile';
import { CAMPAIGN_STATUS_META, inventoryAlert } from '../../seller/groupbuy/campaignMeta';
import AdminCampaigns from './AdminCampaigns';
import AuditTrailPanel from './AuditTrailPanel';
import DisputesPanel from './DisputesPanel';
import FraudAlertsPanel from './FraudAlertsPanel';
import MonitoringPanel from './MonitoringPanel';
import DeliveryPanel from './DeliveryPanel';
import ReportsPanel from './ReportsPanel';
import { Banner, Bar, EmptyState, Loading, Panel, listOf } from './adminUi';

const VIEWS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'campaigns', label: 'Campaigns', icon: Layers },
  { id: 'monitoring', label: 'Monitoring', icon: Activity },
  { id: 'fraud', label: 'Fraud alerts', icon: ShieldAlert, badge: 'openFraudFlags' },
  { id: 'disputes', label: 'Disputes', icon: Gavel, badge: 'openDisputes' },
  { id: 'delivery', label: 'Delivery dates', icon: Truck },
  { id: 'reports', label: 'Analytics & reports', icon: BarChart3 },
  { id: 'audit', label: 'Audit log', icon: FileText },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export default function AdminGroupBuysTab({ initialView, onViewChange }) {
  const [view, setView] = useState(() => (VIEWS.some((v) => v.id === initialView) ? initialView : 'overview'));
  const [campaigns, setCampaigns] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

  // The URL owns the section, so Back and Forward move between sections instead of leaving a stale one on screen
  useEffect(() => {
    setView(VIEWS.some((v) => v.id === initialView) ? initialView : 'overview');
    if (!VIEWS.some((v) => v.id === initialView)) setSelectedCampaignId(null);
  }, [initialView]);

  const load = useCallback(async () => {
    const [campaignRes, overviewRes] = await Promise.allSettled([
      adminGroupBuyApi.getCampaigns(),
      adminGroupBuyApi.getOverview(),
    ]);
    if (campaignRes.status === 'fulfilled') setCampaigns(listOf(campaignRes.value));
    else setError(apiErrorMessage(campaignRes.reason, 'Could not load campaigns'));
    if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value);
    else setError(apiErrorMessage(overviewRes.reason, 'Could not load the overview'));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCampaign = useCallback((id) => {
    setSelectedCampaignId(id);
    setView('campaigns');
    onViewChange?.('campaigns');
  }, [onViewChange]);

  const changeView = (id) => {
    setView(id);
    if (id !== 'campaigns') setSelectedCampaignId(null);
    onViewChange?.(id);
  };

  if (loading) return <Loading label="Loading group buying…" />;

  return (
    <div className="space-y-5">
      <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">Group Buying</h2>
            <p className="text-xs text-slate-400">Watch live groups, handle disputes and abuse, and report on results. Campaigns are published by sellers without an approval step.</p>
          </div>
          <button
            type="button"
            onClick={load}
            className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <nav className="flex flex-wrap gap-1.5">
          {VIEWS.map(({ id, label, icon: Icon, badge }) => {
            const count = badge ? overview?.[badge] || 0 : 0;
            return (
              <button
                key={id}
                type="button"
                onClick={() => changeView(id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  view === id ? 'bg-rose-600 text-white shadow-lg' : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
                {count > 0 && (
                  <span
                    className={`min-w-[18px] px-1.5 py-0.5 rounded-full text-[10px] leading-none ${
                      view === id ? 'bg-white text-rose-700' : 'bg-rose-600 text-white'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <Banner error={error} onClear={() => setError('')} />

      {view === 'overview' && (
        <Overview overview={overview} campaigns={campaigns} onNavigate={changeView} onOpenCampaign={openCampaign} />
      )}
      {view === 'campaigns' && (
        <AdminCampaigns
          campaigns={campaigns}
          selectedId={selectedCampaignId}
          onSelect={setSelectedCampaignId}
          onChanged={load}
        />
      )}
      {view === 'monitoring' && <MonitoringPanel campaigns={campaigns} onOpenCampaign={openCampaign} onChanged={load} />}
      {view === 'fraud' && <FraudAlertsPanel onOpenCampaign={openCampaign} onChanged={load} />}
      {view === 'disputes' && <DisputesPanel onChanged={load} />}
      {view === 'delivery' && <DeliveryPanel />}
      {view === 'reports' && <ReportsPanel onOpenCampaign={openCampaign} />}
      {view === 'audit' && <AuditTrailPanel />}
    </div>
  );
}

function Overview({ overview, campaigns, onNavigate, onOpenCampaign }) {
  const attention = useMemo(() => {
    const now = Date.now();
    const items = [];
    if (overview?.highRiskFlags) {
      items.push({ tone: 'red', text: `${overview.highRiskFlags} high-risk fraud flag(s) in the last 30 days`, go: () => onNavigate('fraud') });
    } else if (overview?.openFraudFlags) {
      items.push({ tone: 'amber', text: `${overview.openFraudFlags} fraud flag(s) to review`, go: () => onNavigate('fraud') });
    }
    if (overview?.openDisputes) {
      items.push({ tone: 'amber', text: `${overview.openDisputes} dispute(s) need a decision`, go: () => onNavigate('disputes') });
    }
    campaigns.forEach((c) => {
      const alert = inventoryAlert(c);
      if (alert) {
        items.push({ tone: alert.level === 'critical' ? 'red' : 'amber', text: `${c.title}: ${alert.message}`, go: () => onOpenCampaign(c.id) });
      }
      const endsIn = new Date(c.endAt).getTime() - now;
      if (c.status === 'ACTIVE' && endsIn > 0 && endsIn < DAY_MS && c.openGroupCount > 0) {
        items.push({
          tone: 'blue',
          text: `${c.title} ends ${formatDateTime(c.endAt)} with ${c.openGroupCount} open group(s)`,
          go: () => onOpenCampaign(c.id),
        });
      }
    });
    return items;
  }, [overview, campaigns, onNavigate, onOpenCampaign]);

  if (!overview) return <EmptyState>The overview is unavailable right now.</EmptyState>;

  const statusRows = Object.entries(overview.campaignsByStatus || {}).filter(([, count]) => count > 0);
  const maxStatus = Math.max(1, ...statusRows.map(([, count]) => count));
  const live = campaigns
    .filter((c) => c.status === 'ACTIVE')
    .sort((a, b) => new Date(a.endAt) - new Date(b.endAt))
    .slice(0, 6);
  const toneClass = {
    red: 'border-rose-800 bg-rose-950/40 text-rose-200',
    amber: 'border-amber-800 bg-amber-950/30 text-amber-200',
    blue: 'border-cyan-900 bg-cyan-950/30 text-cyan-200',
  };

  return (
    <div className="space-y-5 text-xs">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Live campaigns" value={overview.liveCampaigns} hint="Seller-published and running" />
        <StatTile
          label="Open groups"
          value={overview.openGroups}
          hint={`${overview.activeParticipants} shoppers waiting · success rate ${formatPercent(overview.groupSuccessRate)}`}
        />
        <StatTile label="Group buy sales" value={formatMoney(overview.grossSales)} hint={`${formatMoney(overview.customerSavings)} saved by shoppers`} tone="good" />
        <StatTile label="Refunds issued" value={formatMoney(overview.refundsIssued)} hint="failed groups, leavers, price drops and disputes" />
        <StatTile
          label="Stock held by campaigns"
          value={overview.unitsReserved}
          hint={`${overview.unitsCommitted} committed · ${overview.unitsSold} sold all time`}
        />
        <StatTile label="Participations" value={overview.totalParticipations} hint="all time, including leavers" />
        <StatTile label="Open disputes" value={overview.openDisputes} tone={overview.openDisputes ? 'warn' : 'default'} />
        <StatTile
          label="Fraud flags (30 days)"
          value={overview.openFraudFlags}
          hint={`${overview.highRiskFlags} high risk`}
          tone={overview.highRiskFlags ? 'bad' : overview.openFraudFlags ? 'warn' : 'default'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Needs attention" icon={AlertTriangle}>
          {attention.length === 0 ? (
            <EmptyState>Nothing needs attention right now.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {attention.map((item) => (
                <li key={item.text}>
                  <button type="button" onClick={item.go} className={`w-full text-left p-3 rounded-2xl border hover:brightness-125 ${toneClass[item.tone]}`}>
                    {item.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Campaigns by status" icon={Layers}>
          {statusRows.length === 0 ? (
            <EmptyState>No campaigns yet.</EmptyState>
          ) : (
            <ul className="space-y-2.5">
              {statusRows.map(([status, count]) => (
                <li key={status} className="grid grid-cols-[120px_1fr_40px] items-center gap-3">
                  <span className="text-slate-300">{CAMPAIGN_STATUS_META[status]?.label || status}</span>
                  <Bar value={count} max={maxStatus} tone="bg-indigo-500" />
                  <span className="font-mono text-right text-white">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Live campaigns ending soonest" icon={Activity}>
        {live.length === 0 ? (
          <EmptyState>No campaigns are live.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {live.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpenCampaign(c.id)}
                className="text-left p-4 rounded-2xl border border-slate-800 bg-slate-950/50 hover:border-slate-600 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white truncate">{c.title}</span>
                  <CampaignStatusBadge status={c.status} />
                </div>
                <p className="text-slate-400 truncate">{c.sellerStoreName}</p>
                <p className="text-slate-300">
                  {c.openGroupCount} open · {c.successfulGroupCount} won · {c.totalParticipants} shoppers
                </p>
                <Bar value={c.reservedQuantity - c.availableQuantity} max={c.reservedQuantity} tone="bg-emerald-500" />
                <p className="text-[10px] text-slate-500">Ends {formatDateTime(c.endAt)}</p>
              </button>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
