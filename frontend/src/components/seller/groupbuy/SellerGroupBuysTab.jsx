import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Package, Plus, RefreshCw, X } from 'lucide-react';
import axiosClient from '../../../api/axiosClient';
import { sellerGroupBuyApi, apiErrorMessage } from '../../../api/groupBuyApi';
import { formatDateTime, formatMoney, formatPercent } from '../../groupbuy/format';
import CampaignForm from './CampaignForm';
import CampaignDetail from './CampaignDetail';
import CampaignStatusBadge from './CampaignStatusBadge';
import AnalyticsDashboard from '../../groupbuy/analytics/AnalyticsDashboard';
import GroupBuyOrdersPanel from './GroupBuyOrdersPanel';
import StatTile from './StatTile';
import { CAMPAIGN_FILTERS, holdsReservation, inventoryAlert, isTerminal } from './campaignMeta';

const listOf = (res) => (Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []);

const ACTION_MESSAGES = {
  publish: 'Campaign published.',
  pause: 'Campaign paused. Customers cannot start or join groups until you resume it.',
  resume: 'Campaign resumed.',
  cancel: 'Campaign cancelled. Open groups were refunded and unsold stock was released.',
};

export default function SellerGroupBuysTab() {
  const [campaigns, setCampaigns] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // view: { mode: 'list' } | { mode: 'form', campaign? } | { mode: 'detail', id }
  const [view, setView] = useState({ mode: 'list' });
  const [section, setSection] = useState('campaigns');
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [updatingOrder, setUpdatingOrder] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const [campaignRes, productRes, orderRes] = await Promise.allSettled([
      sellerGroupBuyApi.getCampaigns(),
      axiosClient.get('/seller/products'),
      axiosClient.get('/seller/orders'),
    ]);
    if (campaignRes.status === 'fulfilled') setCampaigns(listOf(campaignRes.value));
    else setError(apiErrorMessage(campaignRes.reason, 'Could not load group buy campaigns'));
    if (productRes.status === 'fulfilled') setProducts(listOf(productRes.value));
    if (orderRes.status === 'fulfilled') setOrders(listOf(orderRes.value).filter((o) => o.orderType === 'GROUP_BUY'));
    setRefreshKey((k) => k + 1);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (message) => {
    setError('');
    setNotice(message);
  };

  const handleSave = async (payload, publishNow) => {
    setBusy(true);
    setFormError('');
    const existing = view.campaign;
    let saved;
    try {
      saved = existing
        ? await sellerGroupBuyApi.updateCampaign(existing.id, payload)
        : await sellerGroupBuyApi.createCampaign(payload);
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not save the campaign'));
      setBusy(false);
      return;
    }
    try {
      if (publishNow) await sellerGroupBuyApi.publishCampaign(saved.id);
      flash(publishNow ? 'Saved and published.' : 'Saved as draft.');
    } catch (err) {
      setNotice('');
      setError(`Saved as draft, but publishing failed: ${apiErrorMessage(err)}`);
    }
    await load({ silent: true });
    setView({ mode: 'detail', id: saved.id });
    setBusy(false);
  };

  const handleAction = async (action, campaign, reason) => {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      if (action === 'publish') await sellerGroupBuyApi.publishCampaign(campaign.id);
      if (action === 'pause') await sellerGroupBuyApi.pauseCampaign(campaign.id);
      if (action === 'resume') await sellerGroupBuyApi.resumeCampaign(campaign.id);
      if (action === 'cancel') await sellerGroupBuyApi.cancelCampaign(campaign.id, reason);
      flash(ACTION_MESSAGES[action]);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
    await load({ silent: true });
    setBusy(false);
  };

  const handleOrderStatus = async (orderNumber, status) => {
    setUpdatingOrder(orderNumber);
    setError('');
    try {
      await axiosClient.put(`/seller/orders/${orderNumber}/status`, { status });
      setOrders((prev) => prev.map((o) => (o.orderNumber === orderNumber ? { ...o, status } : o)));
      flash(`Order ${orderNumber} marked ${status.toLowerCase()}.`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update the order'));
    } finally {
      setUpdatingOrder(null);
    }
  };

  const stats = useMemo(() => {
    const count = (statuses) => campaigns.filter((c) => statuses.includes(c.status)).length;
    return {
      live: count(['ACTIVE']),
      scheduled: count(['SCHEDULED', 'PAUSED']),
      drafts: count(['DRAFT']),
      participants: campaigns.reduce((s, c) => s + (c.totalParticipants || 0), 0),
      revenue: orders.filter((o) => o.status !== 'CANCELLED').reduce((s, o) => s + (Number(o.totalAmount) || 0), 0),
    };
  }, [campaigns, orders]);

  const alerts = useMemo(
    () => campaigns.map((c) => ({ campaign: c, alert: inventoryAlert(c) })).filter((x) => x.alert),
    [campaigns]
  );

  const visibleCampaigns = useMemo(() => {
    const statuses = CAMPAIGN_FILTERS.find((f) => f.id === filter)?.statuses;
    return statuses ? campaigns.filter((c) => statuses.includes(c.status)) : campaigns;
  }, [campaigns, filter]);

  const banner = (
    <>
      {error && (
        <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-800 text-rose-200 text-xs flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-950/50 border border-emerald-800 text-emerald-200 text-xs flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {notice}
          </span>
          <button onClick={() => setNotice('')} aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400 text-xs">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-3" /> Loading group buys…
      </div>
    );
  }

  if (view.mode === 'form') {
    return (
      <div className="space-y-4">
        {banner}
        <CampaignForm
          key={view.campaign?.id || 'new'}
          campaign={view.campaign}
          products={products}
          saving={busy}
          serverError={formError}
          onSave={handleSave}
          onCancel={() => {
            setFormError('');
            setView(view.campaign ? { mode: 'detail', id: view.campaign.id } : { mode: 'list' });
          }}
        />
      </div>
    );
  }

  const detailCampaign = view.mode === 'detail' ? campaigns.find((c) => c.id === view.id) : null;
  if (detailCampaign) {
    return (
      <div className="space-y-4">
        {banner}
        <CampaignDetail
          campaign={detailCampaign}
          orders={orders}
          busy={busy}
          refreshKey={refreshKey}
          updatingOrder={updatingOrder}
          onBack={() => setView({ mode: 'list' })}
          onEdit={(campaign) => {
            setFormError('');
            setView({ mode: 'form', campaign });
          }}
          onAction={handleAction}
          onOrderStatusChange={handleOrderStatus}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {banner}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
          {[
            ['campaigns', `Campaigns (${campaigns.length})`],
            ['inventory', `Inventory${alerts.length ? ` (${alerts.length} alert${alerts.length > 1 ? 's' : ''})` : ''}`],
            ['orders', `Orders (${orders.length})`],
            ['analytics', 'Analytics'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                section === id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load({ silent: true })}
            className="px-3 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={() => {
              setFormError('');
              setView({ mode: 'form' });
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" /> New group buy
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatTile label="Live" value={stats.live} tone="good" />
        <StatTile label="Scheduled / paused" value={stats.scheduled} />
      <StatTile label="Drafts" value={stats.drafts} />
        <StatTile label="Participants" value={stats.participants} />
        <StatTile label="Group buy revenue" value={formatMoney(stats.revenue)} tone="good" />
      </div>

      {section === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5 text-xs">
            {CAMPAIGN_FILTERS.map((f) => {
              const n = f.statuses ? campaigns.filter((c) => f.statuses.includes(c.status)).length : campaigns.length;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-3 py-1.5 rounded-full border font-bold transition ${
                    filter === f.id
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label} ({n})
                </button>
              );
            })}
          </div>

          {visibleCampaigns.length === 0 ? (
            <div className="glass-panel p-10 rounded-3xl border border-slate-800 text-center space-y-3">
              <p className="text-sm font-bold text-white">
                {campaigns.length === 0 ? 'No group buys yet' : 'No campaigns match this filter'}
              </p>
              {campaigns.length === 0 && (
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Offer a tiered price that drops as more shoppers join. Create a draft, set the price ladder, and
                  publish it.
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {visibleCampaigns.map((c) => {
                const alert = inventoryAlert(c);
                return (
                  <button
                    key={c.id}
                    onClick={() => setView({ mode: 'detail', id: c.id })}
                    className="glass-card p-4 rounded-3xl border border-slate-800 hover:border-indigo-600 transition text-left flex gap-4"
                  >
                    <div className="w-16 h-16 rounded-xl bg-slate-800 overflow-hidden shrink-0 border border-slate-700 flex items-center justify-center">
                      {c.productImageUrl ? (
                        <img src={c.productImageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-6 h-6 text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1.5 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-white truncate">{c.title}</span>
                        <CampaignStatusBadge status={c.status} />
                      </div>
                      <p className="text-slate-400 truncate">
                        {c.productName} · {formatMoney(c.basePrice)} → {formatMoney(c.lowestPrice)}{' '}
                        <span className="text-emerald-400 font-bold">({formatPercent(c.maxDiscountPercent)} off)</span>
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {isTerminal(c.status)
                          ? `Ended ${formatDateTime(c.closedAt || c.endAt)}`
                          : `${formatDateTime(c.startAt)} – ${formatDateTime(c.endAt)}`}
                        {' · '}
                        {c.openGroupCount} open · {c.successfulGroupCount} successful · {c.totalParticipants} participants
                        {holdsReservation(c.status) && ` · ${c.availableQuantity}/${c.reservedQuantity} units left`}
                      </p>
                      {alert && (
                        <p
                          className={`text-[10px] flex items-center gap-1 ${
                            alert.level === 'critical' ? 'text-rose-300' : 'text-amber-300'
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3" /> {alert.message}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {section === 'inventory' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Published campaigns move their reserved units out of regular product stock. Unsold units return to stock when
            the campaign ends or is cancelled.
          </p>
          <div className="glass-card rounded-3xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/90 text-slate-400 uppercase font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-4">Campaign</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Reserved</th>
                    <th className="p-4 text-right">Sold</th>
                    <th className="p-4 text-right">Available</th>
                    <th className="p-4 text-right">Product stock</th>
                    <th className="p-4">Alert</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {campaigns.filter((c) => !isTerminal(c.status)).length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No running or upcoming campaigns.
                      </td>
                    </tr>
                  )}
                  {campaigns
                    .filter((c) => !isTerminal(c.status))
                    .map((c) => {
                      const alert = inventoryAlert(c);
                      return (
                        <tr
                          key={c.id}
                          onClick={() => setView({ mode: 'detail', id: c.id })}
                          className="hover:bg-slate-900/40 cursor-pointer"
                        >
                          <td className="p-4">
                            <span className="font-bold text-white block">{c.title}</span>
                            <span className="text-[10px] text-slate-500">{c.productName}</span>
                          </td>
                          <td className="p-4">
                            <CampaignStatusBadge status={c.status} />
                          </td>
                          <td className="p-4 text-right font-mono">{c.reservedQuantity}</td>
                          <td className="p-4 text-right font-mono text-emerald-300">{c.soldQuantity}</td>
                          <td className="p-4 text-right font-mono font-bold text-white">
                            {holdsReservation(c.status) ? c.availableQuantity : '—'}
                          </td>
                          <td className="p-4 text-right font-mono">{c.productStock}</td>
                          <td className="p-4">
                            {alert ? (
                              <span
                                className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                                  alert.level === 'critical'
                                    ? 'bg-rose-950 border-rose-800 text-rose-300'
                                    : 'bg-amber-950 border-amber-800 text-amber-300'
                                }`}
                                title={alert.message}
                              >
                                {alert.level === 'critical' ? 'Critical' : 'Low'}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500">OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
          {alerts.length > 0 && (
            <ul className="space-y-1.5">
              {alerts.map(({ campaign, alert }) => (
                <li
                  key={campaign.id}
                  className={`text-xs flex items-center gap-2 ${alert.level === 'critical' ? 'text-rose-300' : 'text-amber-300'}`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <strong>{campaign.title}:</strong> {alert.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {section === 'analytics' && (
        <AnalyticsDashboard
          scope="seller"
          accent="indigo"
          fetchAnalytics={sellerGroupBuyApi.getAnalytics}
          onSaveUnitCost={sellerGroupBuyApi.updateUnitCost}
          onOpenCampaign={(id) => setView({ mode: 'detail', id })}
        />
      )}

      {section === 'orders' && (
        <GroupBuyOrdersPanel
          orders={orders}
          updatingOrder={updatingOrder}
          onStatusChange={handleOrderStatus}
          emptyText="Orders are created automatically when a group succeeds."
        />
      )}
    </div>
  );
}
