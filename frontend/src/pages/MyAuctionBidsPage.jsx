import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Gavel, Loader2, Package, RefreshCcw, Ticket, XCircle } from 'lucide-react';
import { groupBuyingAuctionApi } from '../api/groupBuyingAuctionApi';
import { apiErrorMessage } from '../api/groupBuyApi';
import useLiveReload, { topics } from '../components/groupbuy/useLiveReload';
import { formatDateTime, formatMoney } from '../components/groupbuy/format';
import { BidStatusBadge } from '../components/auction/AuctionStatusBadge';

const TABS = [
  { id: 'active', label: 'Open bids', statuses: ['BID_PLACED'] },
  { id: 'won', label: 'Bids won', statuses: ['WON'] },
  { id: 'outbid', label: 'Outbid / refunded', statuses: ['OUTBID', 'REFUNDED'] },
  { id: 'cancelled', label: 'Withdrawn', statuses: ['CANCELLED'] },
  { id: 'all', label: 'All history', statuses: null },
];

export default function MyAuctionBidsPage() {
  const [tab, setTab] = useState('active');
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await groupBuyingAuctionApi.getMyParticipations();
      setBids(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your bids.'));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  useLiveReload([topics.GROUP_BUYING_AUCTION], () => load(false));

  const visible = useMemo(() => {
    const statuses = TABS.find((t) => t.id === tab)?.statuses;
    return statuses ? bids.filter((b) => statuses.includes(b.status)) : bids;
  }, [bids, tab]);

  const handleCancel = async (bid) => {
    setBusyId(bid.id);
    setError('');
    setNotice('');
    try {
      await groupBuyingAuctionApi.cancelParticipation(bid.id);
      setNotice('Your bid was withdrawn and refunded in full.');
      await load(false);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not withdraw your bid.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Ticket className="w-7 h-7 text-amber-400" /> My bids
          </h1>
          <p className="text-xs text-slate-400">
            Bids you placed in collective auctions, and what each one settled at.
          </p>
        </div>
        <Link
          to="/group-buying-auctions"
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold"
        >
          Browse auctions
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        {TABS.map((t) => {
          const n = t.statuses ? bids.filter((b) => t.statuses.includes(b.status)).length : bids.length;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-full border font-bold transition ${
                tab === t.id
                  ? 'bg-amber-600 border-amber-500 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {t.label} ({n})
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {notice && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-800 rounded-2xl text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {notice}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="glass-card p-10 rounded-3xl border border-slate-800 text-center space-y-2">
          <Gavel className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-300">No bids here</p>
          <p className="text-xs text-slate-500">Place a bid in an open auction to see it here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((bid) => (
            <BidCard key={bid.id} bid={bid} busy={busyId === bid.id} onCancel={() => handleCancel(bid)} />
          ))}
        </div>
      )}
    </div>
  );
}

function BidCard({ bid, busy, onCancel }) {
  return (
    <div className="glass-card p-4 rounded-3xl border border-slate-800 flex flex-col sm:flex-row gap-4">
      <div className="w-16 h-16 rounded-xl bg-slate-800 overflow-hidden shrink-0 border border-slate-700 flex items-center justify-center">
        {bid.productImageUrl ? (
          <img src={bid.productImageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <Package className="w-6 h-6 text-slate-500" />
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1.5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-white truncate">{bid.productName}</span>
          <BidStatusBadge status={bid.status} />
        </div>
        <p className="text-slate-400">
          {bid.quantity} unit(s), max {formatMoney(bid.maxUnitPrice)} each — authorised{' '}
          <span className="text-white font-bold">{formatMoney(bid.totalAmount)}</span>
        </p>

        {bid.status === 'BID_PLACED' && (
          <p className="text-[10px] text-slate-500">
            {bid.auctionCollectiveQuantity} of {bid.auctionMinimumCollectiveQuantity} units bid · closes{' '}
            {formatDateTime(bid.auctionEndsAt)}
          </p>
        )}

        {bid.status === 'WON' && (
          <p className="text-[10px] text-emerald-300">
            Settled at {formatMoney(bid.orderUnitPrice ?? bid.auctionFinalUnitPrice)} per unit · order{' '}
            {bid.orderNumber}
          </p>
        )}

        {bid.status === 'OUTBID' && (
          <p className="text-[10px] text-amber-300 flex items-center gap-1.5">
            <XCircle className="w-3 h-3" /> The final price rose above your maximum, so you were not charged.
          </p>
        )}

        {(bid.status === 'REFUNDED' || bid.status === 'CANCELLED') && (
          <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
            <RefreshCcw className="w-3 h-3" /> Refunded {formatMoney(bid.refundAmount)}
            {bid.status === 'CANCELLED' ? ` on ${formatDateTime(bid.cancelledAt)}` : ''}.
          </p>
        )}
      </div>

      <div className="flex sm:flex-col gap-2 sm:items-end justify-center shrink-0">
        {bid.status === 'BID_PLACED' && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 rounded-xl border border-rose-800 text-rose-300 hover:bg-rose-950 text-xs font-bold disabled:opacity-50"
          >
            {busy ? 'Withdrawing…' : 'Withdraw bid'}
          </button>
        )}
        {bid.orderNumber && (
          <Link
            to="/orders"
            className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold text-center"
          >
            View order
          </Link>
        )}
      </div>
    </div>
  );
}
