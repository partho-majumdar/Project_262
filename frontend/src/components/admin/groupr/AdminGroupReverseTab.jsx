import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Users, XCircle } from 'lucide-react';
import { adminGroupReverseApi } from '../../../api/groupReverseApi';
import useLiveReload, { topics } from '../../groupbuy/useLiveReload';
import { apiErrorMessage } from '../../../api/groupBuyApi';
import { listOf } from '../groupbuy/adminUi';
import { formatDateTime, formatMoney } from '../../groupbuy/format';
import { GroupReverseStatusBadge } from '../../groupr/GroupReverseOfferCard';

/** A seller has been chosen, so the group is a contract and can no longer be cancelled. */
function isCancelable(demand) {
  return !demand.selectedOfferId
    && !['CANCELLED', 'COMPLETED', 'CLOSED', 'EXPIRED', 'WITHDRAWN'].includes(demand.status);
}

const STATUS_FILTERS = ['', 'OPEN', 'TARGET_REACHED', 'READY_FOR_OFFERS', 'OFFERS_RECEIVED',
  'OFFER_SELECTED', 'ORDERS_CREATED', 'FULFILLING', 'CANCELLED'];

/**
 * Platform oversight for customer-led group reverse buying. Every group is visible here regardless of
 * who leads it. Cancelling returns every member's reserved quantity, and is only offered before a
 * seller has been selected - after that the group is contractually committed and the server refuses.
 */
export default function AdminGroupReverseTab() {
  const [demands, setDemands] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await adminGroupReverseApi.getDemands(status || undefined);
      setDemands(listOf(rows));
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load group demands.'));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Must be a top-level hook call: useLiveReload itself calls hooks, and calling it from
  // inside the effect above threw "Invalid hook call" and blanked the whole admin page.
  useLiveReload([topics.GROUP_REVERSE, topics.ADMIN], load);

  const cancel = async (demand) => {
    const reason = window.prompt(
      `Force-cancel "${demand.productName}"? Every member's reserved quantity is released.`,
      'Administrative closure',
    );
    if (reason === null) return;
    setBusyId(demand.id);
    setError('');
    setNotice('');
    try {
      await adminGroupReverseApi.cancelDemand(demand.id, reason);
      setNotice(`Cancelled the group for "${demand.productName}".`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not cancel this group.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">Group reverse buying oversight</h2>
            <p className="text-xs text-slate-400">
              Customer-led buying groups. Force-cancelling releases every member&apos;s reserved
              quantity, and is only possible before a seller has been selected.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
        <nav className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((value) => (
            <button
              key={value || 'all'}
              type="button"
              onClick={() => setStatus(value)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                status === value
                  ? 'bg-rose-600 text-white shadow-lg'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              {value ? value.replace(/_/g, ' ') : 'All'}
            </button>
          ))}
        </nav>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-800 bg-rose-950/40 p-4 text-rose-200 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="rounded-2xl border border-emerald-800 bg-emerald-950/40 p-4 text-emerald-200 text-sm">
          {notice}
        </div>
      )}

      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-slate-400">Loading group demands…</p>
        ) : demands.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">No group demands match this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/70 text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Leader</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Locked price</th>
                  <th className="px-4 py-3">Closes</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {demands.map((demand) => (
                  <tr key={demand.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-bold text-white">{demand.productName}</p>
                      <p className="text-slate-500">{demand.deliveryCity}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{demand.leaderName}</td>
                    <td className="px-4 py-3 text-slate-300">
                      <span className="font-bold text-white">
                        {demand.committedQuantity}/{demand.requiredQuantity}
                      </span>
                      <span className="ml-2 text-slate-500 flex items-center gap-1 inline-flex">
                        <Users className="w-3 h-3" /> {demand.memberCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <GroupReverseStatusBadge status={demand.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {demand.lockedUnitPrice != null
                        ? formatMoney(demand.lockedUnitPrice)
                        : <span className="text-slate-500">target {formatMoney(demand.targetPrice)}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{formatDateTime(demand.offerDeadline)}</td>
                    <td className="px-4 py-3 text-right">
                      {isCancelable(demand) ? (
                        <button
                          type="button"
                          onClick={() => cancel(demand)}
                          disabled={busyId === demand.id}
                          className="px-3 py-1.5 rounded-xl border border-rose-800 text-rose-300 hover:bg-rose-950 text-[11px] font-bold disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Force-cancel
                        </button>
                      ) : (
                        <span className="text-slate-600 text-[11px] font-bold">Committed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
