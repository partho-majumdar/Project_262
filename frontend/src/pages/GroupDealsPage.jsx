import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Loader2, Search, Sparkles, Store, Ticket, Users } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { groupBuyApi, apiErrorMessage } from '../api/groupBuyApi';
import { inviteRoute } from '../components/groupbuy/inviteCode';
import { useAuth } from '../context/AuthContext';
import CountdownTimer from '../components/groupbuy/CountdownTimer';
import useLiveReload, { topics } from '../components/groupbuy/useLiveReload';
import { formatMoney, formatPercent } from '../components/groupbuy/format';

const SORT_OPTIONS = [
  { value: 'popular', label: 'Most popular' },
  { value: 'ending_soon', label: 'Ending soon' },
  { value: 'discount', label: 'Biggest discount' },
  { value: 'price_low', label: 'Lowest group price' },
  { value: 'newest', label: 'Newest' },
];

export default function GroupDealsPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [deals, setDeals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('popular');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDeals = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        const data = await groupBuyApi.getDeals({
          q: appliedQuery || undefined,
          category: category || undefined,
          sort,
        });
        setDeals(Array.isArray(data) ? data : []);
        setError('');
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not load group deals.'));
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [appliedQuery, category, sort],
  );

  useEffect(() => {
    loadDeals(true);
  }, [loadDeals]);

  useLiveReload([topics.GROUP_BUY, topics.STOREFRONT], () => loadDeals(false));

  useEffect(() => {
    axiosClient
      .get('/categories')
      .then((res) => {
        const payload = res?.data;
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.content)
            ? payload.content
            : Array.isArray(payload?.data)
              ? payload.data
              : [];
        setCategories(list);
      })
      .catch(() => setCategories([]));
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setAppliedQuery(query.trim());
  };

  const handleJoinByCode = (e) => {
    e.preventDefault();
    const route = inviteRoute(inviteCode);
    if (route) navigate(route);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Hero */}
      <div className="glass-panel p-6 sm:p-10 rounded-3xl relative overflow-hidden space-y-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-nexus-950 border border-nexus-500/30 text-nexus-400 text-xs font-semibold">
          <Users className="w-3.5 h-3.5 text-emerald-400" /> Group Buying
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          Team up. <span className="text-emerald-400">Unlock lower prices.</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
          Start a group or join one. Every new member moves the whole group down the price ladder. If a group
          doesn't fill before its timer ends, everyone is refunded automatically.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          {isAuthenticated && (
            <Link
              to="/group-buy/my-groups"
              className="px-4 py-2 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Ticket className="w-3.5 h-3.5" /> My groups
            </Link>
          )}
          <form onSubmit={handleJoinByCode} className="flex items-center gap-2">
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Group code or invite link"
              maxLength={200}
              className="w-56 bg-slate-950 border border-slate-800 focus:border-nexus-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder:font-sans placeholder:text-slate-500"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold transition"
            >
              Join
            </button>
          </form>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search group deals…"
            className="w-full bg-slate-900 border border-slate-800 focus:border-nexus-500 rounded-2xl py-2.5 pl-10 pr-4 text-xs text-slate-100 placeholder:text-slate-500"
          />
        </form>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-2xl px-3 py-2.5 text-xs text-slate-200"
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat.id || cat.slug} value={cat.slug}>
              {cat.name}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-2xl px-3 py-2.5 text-xs text-slate-200"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-nexus-500 animate-spin" />
        </div>
      ) : deals.length === 0 ? (
        <div className="glass-card p-10 rounded-3xl border border-slate-800 text-center space-y-2">
          <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-300">No group deals right now</p>
          <p className="text-xs text-slate-500">Check back soon. Sellers launch new group buys regularly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </div>
  );
}

function DealCard({ deal }) {
  return (
    <Link
      to={`/group-deals/${deal.id}`}
      className="group glass-card rounded-3xl border border-slate-800 hover:border-nexus-500/60 overflow-hidden flex flex-col transition"
    >
      <div className="relative aspect-[4/3] bg-slate-900 overflow-hidden">
        {deal.productImageUrl ? (
          <img
            src={deal.productImageUrl}
            alt={deal.productName}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            <Users className="w-10 h-10" />
          </div>
        )}
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-extrabold shadow-lg">
          Up to {formatPercent(deal.maxDiscountPercent)} off
        </span>
        <span className="absolute top-3 right-3 px-2 py-1 rounded-full bg-slate-950/80 border border-slate-700">
          <CountdownTimer expiresAt={deal.endAt} variant="compact" />
        </span>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-extrabold text-white line-clamp-1">{deal.title}</h3>
          <p className="text-[11px] text-slate-400 line-clamp-1">{deal.productName}</p>
          <p className="text-[10px] text-slate-500 flex items-center gap-1">
            <Store className="w-3 h-3" /> {deal.sellerStoreName}
            {deal.categoryName && <> · {deal.categoryName}</>}
          </p>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-xl font-extrabold text-emerald-400 font-mono">{formatMoney(deal.lowestPrice)}</span>
          <span className="text-xs text-slate-500 line-through font-mono">{formatMoney(deal.basePrice)}</span>
          <span className="text-[10px] text-slate-400">with a full group</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
          <div className="p-2 bg-slate-950/70 border border-slate-800 rounded-xl">
            <p className="font-mono font-bold text-white text-sm">{deal.totalParticipants}</p>
            <p className="text-slate-500">joined</p>
          </div>
          <div className="p-2 bg-slate-950/70 border border-slate-800 rounded-xl">
            <p className="font-mono font-bold text-white text-sm">{deal.openGroupCount}</p>
            <p className="text-slate-500">open groups</p>
          </div>
          <div className="p-2 bg-slate-950/70 border border-slate-800 rounded-xl">
            <p className="font-mono font-bold text-white text-sm">{deal.minParticipants}+</p>
            <p className="text-slate-500">group size</p>
          </div>
        </div>

        <span className="mt-auto inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-nexus-600 group-hover:bg-nexus-500 text-white text-xs font-bold transition">
          View deal <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}
