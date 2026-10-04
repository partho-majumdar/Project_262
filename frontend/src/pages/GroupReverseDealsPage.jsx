import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, PlusCircle, Search, Users } from 'lucide-react';
import { groupReverseApi, GROUP_REVERSE_DEMAND_STATUS } from '../api/groupReverseApi';
import { apiErrorMessage } from '../api/groupBuyApi';
import { formatMoney } from '../components/groupbuy/format';
import useLiveReload, { topics } from '../components/groupbuy/useLiveReload';
import GroupReverseProgress from '../components/groupr/GroupReverseProgress';
import { DeadlineLabel, GroupReverseStatusBadge } from '../components/groupr/GroupReverseOfferCard';
import { useAuth } from '../context/AuthContext';

const FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'OPEN', label: 'Still collecting members' },
  { id: 'READY_FOR_OFFERS', label: 'Waiting on sellers' },
  { id: 'OFFERS_RECEIVED', label: 'Bids to compare' },
];

/**
 * The customer-created demand board. Unlike the seller-initiated Reverse Group Buying list, every row
 * here started with one person saying "I need 50 of these" and waiting for strangers to help.
 */
export default function GroupReverseDealsPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setDemands((await groupReverseApi.getDemands()) ?? []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load group demands.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // A group filling up, a member leaving, a seller being chosen: all of it lands here without a
  // refresh, which is the whole point of a group that strangers are joining in real time.
  useLiveReload([topics.GROUP_REVERSE, topics.STOREFRONT], load);


  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (demands ?? []).filter((demand) => {
      if (filter !== 'ALL' && demand.status !== filter) return false;
      if (!needle) return true;
      return (
        (demand.productName ?? '').toLowerCase().includes(needle) ||
        (demand.description ?? '').toLowerCase().includes(needle) ||
        (demand.leaderName ?? '').toLowerCase().includes(needle)
      );
    });
  }, [demands, filter, query]);

  const requireLogin = (message) => {
    navigate('/login', { state: { from: location, message } });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-[11px] font-bold">
            <Users className="w-3.5 h-3.5" /> Group-Based Reverse Buying
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Start a group, or join one
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Here customers go first. One of you names the quantity and the price you would accept,
            strangers fill the rest, and sellers then bid for the whole group. You pick the seller,
            and every member is billed separately for their own share.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            isAuthenticated
              ? navigate('/group-reverse/new')
              : requireLogin('Sign in to start a group demand.')
          }
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition"
        >
          <PlusCircle className="w-4 h-4" /> Start a group demand
        </button>
      </header>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by product, description or who is asking"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:border-indigo-600 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                filter === option.id
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <p className="text-slate-400 text-sm">No group demands match that.</p>
          <p className="text-xs text-slate-600">
            Groups only exist once somebody starts one — try being the first.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((demand) => (
            <Link
              key={demand.id}
              to={`/group-reverse/${demand.id}`}
              className="group rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-indigo-600 p-4 space-y-3 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-bold text-white line-clamp-2 group-hover:text-indigo-300">
                  {demand.productName}
                </h2>
                <GroupReverseStatusBadge status={demand.status} />
              </div>

              {demand.description && (
                <p className="text-xs text-slate-400 line-clamp-2">{demand.description}</p>
              )}

              <GroupReverseProgress demand={demand} />

              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-slate-500">Target price</dt>
                  <dd className="text-white font-bold">{formatMoney(demand.targetPrice)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Ceiling</dt>
                  <dd className="text-slate-300 font-semibold">{formatMoney(demand.maxPrice)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Bids</dt>
                  <dd className="text-slate-300 font-semibold">{demand.offerCount}</dd>
                </div>
              </dl>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
                <span className="text-[11px] text-slate-500">Started by {demand.leaderName}</span>
                <DeadlineLabel
                  iso={demand.status === 'OPEN' ? demand.joinDeadline : demand.offerDeadline}
                  prefix={demand.status === 'OPEN' ? 'Joins close in' : 'Offers close in'}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export { GROUP_REVERSE_DEMAND_STATUS };
