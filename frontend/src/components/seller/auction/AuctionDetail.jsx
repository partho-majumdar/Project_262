import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Edit3,
  Gavel,
  Package,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react';
import { sellerAuctionApi } from '../../../api/groupBuyingAuctionApi';
import { apiErrorMessage } from '../../../api/groupBuyApi';
import { formatDateTime, formatMoney } from '../../groupbuy/format';
import AuctionPriceLadder from '../../auction/AuctionPriceLadder';
import { AuctionStatusBadge, BidStatusBadge } from '../../auction/AuctionStatusBadge';
import { canCancelAuction, canEditAuction, canFinalizeAuction, canPublishAuction } from '../../auction/auctionMeta';

export default function AuctionDetail({ auction, busy, refreshKey, onBack, onEdit, onAction }) {
  const [participations, setParticipations] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError('');
    sellerAuctionApi
      .getParticipations(auction.id)
      .then((list) => !ignore && setParticipations(Array.isArray(list) ? list : []))
      .catch((err) => !ignore && setError(apiErrorMessage(err, 'Could not load bids')))
      .finally(() => !ignore && setLoading(false));

    if (auction.finalized) {
      sellerAuctionApi
        .getResult(auction.id)
        .then((data) => !ignore && setResult(data))
        .catch(() => !ignore && setResult(null));
    } else {
      setResult(null);
    }
    return () => {
      ignore = true;
    };
  }, [auction.id, auction.finalized, refreshKey]);

  const actionButton = 'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50';

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 font-bold">
        <ArrowLeft className="w-4 h-4" /> Back to auctions
      </button>

      <div className="glass-panel p-5 rounded-3xl border border-slate-800 flex flex-col md:flex-row gap-5">
        <div className="w-full md:w-28 h-28 rounded-2xl bg-slate-800 overflow-hidden shrink-0 border border-slate-700 flex items-center justify-center">
          {auction.productImageUrl ? (
            <img src={auction.productImageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Package className="w-8 h-8 text-slate-500" />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <AuctionStatusBadge status={auction.status} />
            <span className="text-[10px] text-slate-500">Created {formatDateTime(auction.createdAt)}</span>
          </div>
          <h2 className="text-xl font-black text-white">{auction.productName}</h2>
          <p className="text-xs text-slate-400">
            Starts at {formatMoney(auction.startingPrice)}
            {auction.minimumSellerUnitPrice != null && ` · floor ${formatMoney(auction.minimumSellerUnitPrice)}`} ·
            minimum {auction.minimumCollectiveQuantity} units · up to {auction.availableQuantity} units
          </p>
          <p className="text-[11px] text-slate-500">
            {formatDateTime(auction.startsAt)} → {formatDateTime(auction.endsAt)} ·{' '}
            {auction.minQuantityPerCustomer}–{auction.maxQuantityPerCustomer} units per bidder
          </p>
        </div>
        <div className="flex flex-wrap md:flex-col gap-2 md:items-stretch">
          {canEditAuction(auction.status) && (
            <button
              onClick={() => onEdit(auction)}
              disabled={busy}
              className={`${actionButton} bg-slate-900 border border-slate-700 hover:border-amber-500 text-slate-100`}
            >
              <Edit3 className="w-4 h-4" /> Edit
            </button>
          )}
          {canPublishAuction(auction.status) && (
            <button
              onClick={() => onAction('publish', auction)}
              disabled={busy}
              className={`${actionButton} bg-amber-600 hover:bg-amber-500 text-white`}
            >
              <Send className="w-4 h-4" /> Publish
            </button>
          )}
          {canFinalizeAuction(auction.status) && (
            <button
              onClick={() => onAction('finalize', auction)}
              disabled={busy}
              className={`${actionButton} bg-indigo-600 hover:bg-indigo-500 text-white`}
            >
              <Gavel className="w-4 h-4" /> Finalize now
            </button>
          )}
          {canCancelAuction(auction.status) && (
            <button
              onClick={() => setCancelOpen((v) => !v)}
              disabled={busy}
              className={`${actionButton} bg-slate-900 border border-rose-800 hover:bg-rose-950 text-rose-300`}
            >
              <XCircle className="w-4 h-4" /> Cancel auction
            </button>
          )}
        </div>
      </div>

      {cancelOpen && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800 space-y-3 text-xs">
          <p className="font-bold text-rose-200">
            Cancelling refunds every bid and releases the reserved inventory. This can't be undone.
          </p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason (optional)"
            rows={2}
            className="w-full bg-slate-900 border border-rose-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                onAction('cancel', auction, cancelReason.trim());
                setCancelOpen(false);
                setCancelReason('');
              }}
              disabled={busy}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold"
            >
              Confirm cancellation
            </button>
            <button
              onClick={() => setCancelOpen(false)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-bold"
            >
              Never mind
            </button>
          </div>
        </div>
      )}

      <div className="glass-card rounded-3xl border border-slate-800 p-5 space-y-4">
        <h3 className="text-sm font-black text-white">Collective price ladder</h3>
        <p className="text-[11px] text-slate-400">
          {auction.collectiveQuantity} of {auction.minimumCollectiveQuantity} units bid ·{' '}
          {auction.participantCount} bidder{auction.participantCount === 1 ? '' : 's'} ·{' '}
          {auction.remainingQuantity} unit(s) still available
        </p>
        <AuctionPriceLadder auction={auction} />

        {result && (
          <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/60 space-y-1.5 text-xs">
            <p className="font-bold text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Finalized at {formatMoney(result.finalUnitPrice)} per unit
            </p>
            <p className="text-slate-300">
              {result.winningBidCount} bid(s) won, {result.outbidCount} outbid and refunded, across{' '}
              {result.collectiveQuantity} units bid.
            </p>
            <p className="text-slate-300">
              {result.winningQuantity ?? result.collectiveQuantity} unit(s) sold at{' '}
              {formatMoney(result.finalUnitPrice)}
              {result.outbidQuantity ? `, ${result.outbidQuantity} unit(s) outbid and released` : ''}.
            </p>
            {result.totalSuccessfulSales != null && (
              <p className="font-bold text-emerald-300">
                Total successful sales: {formatMoney(result.totalSuccessfulSales)}
              </p>
            )}
            <p className="text-[10px] text-slate-500">
              Every winner paid {formatMoney(result.finalUnitPrice)} per unit, whatever their own maximum was.
              Finalized {formatDateTime(result.finalizedAt)}
            </p>
          </div>
        )}
      </div>

      <div className="glass-card rounded-3xl border border-slate-800 p-5 space-y-4">
        <h3 className="text-sm font-black text-white">Bids</h3>
        {loading ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-amber-500 mb-2" /> Loading bids…
          </div>
        ) : error ? (
          <p className="text-xs text-rose-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {error}
          </p>
        ) : participations.length === 0 ? (
          <p className="text-xs text-slate-400">No bids yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 uppercase font-bold">
                <tr>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Placed</th>
                  <th className="p-3">Quantity</th>
                  <th className="p-3">Max unit price</th>
                  <th className="p-3">Authorised</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {participations.map((bid) => (
                  <tr key={bid.id} className="hover:bg-slate-900/40">
                    <td className="p-3">
                      <p className="font-bold text-white">{bid.userName || 'Bidder'}</p>
                      <p className="text-slate-500">{bid.userEmail}</p>
                    </td>
                    <td className="p-3 text-slate-400">{formatDateTime(bid.bidAt)}</td>
                    <td className="p-3 font-mono">{bid.quantity}</td>
                    <td className="p-3 font-mono">{formatMoney(bid.maxUnitPrice)}</td>
                    <td className="p-3 font-bold text-white">{formatMoney(bid.totalAmount)}</td>
                    <td className="p-3">
                      <BidStatusBadge status={bid.status} />
                    </td>
                    <td className="p-3 text-slate-400">
                      {bid.orderNumber ? `${bid.orderNumber} · ${bid.orderStatus}` : '—'}
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
