import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Gavel, Users } from 'lucide-react';
import { formatMoney, formatDateTime } from '../groupbuy/format';
import { AuctionStatusBadge } from './AuctionStatusBadge';
import { reserveLine, secondsRemaining } from './proxyAuctionMeta';

/** Compact duration, e.g. "2d 4h", "3h 12m", "48s". */
export const shortDuration = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  if (s === 0) return 'Ended';
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

/**
 * One auction in a list. Used by the public marketplace and by the customer's "My Bids", where the
 * same card gains a line reporting how that particular bid is doing.
 */
export default function ProxyAuctionCard({ auction, bid, footer }) {
  const remaining = secondsRemaining(auction);
  const reserve = reserveLine(auction);
  const urgent = auction.status === 'LIVE' && remaining > 0 && remaining < 3600;
  const sold = auction.status === 'SOLD' && auction.finalPrice != null;

  return (
    <Link
      to={`/auctions/${auction.id}`}
      className="glass-card p-4 rounded-2xl border border-slate-800 hover:border-amber-500/60 transition-all flex flex-col gap-3"
    >
      <div className="flex gap-3">
        <div className="w-20 h-20 rounded-xl bg-slate-800/80 overflow-hidden shrink-0 flex items-center justify-center">
          {auction.productImageUrl ? (
            <img src={auction.productImageUrl} alt={auction.productName} className="w-full h-full object-cover" />
          ) : (
            <Gavel className="w-7 h-7 text-slate-600" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-white truncate">{auction.productName}</h3>
            <AuctionStatusBadge status={auction.status} />
          </div>
          {auction.sellerStoreName && (
            <p className="text-[11px] text-slate-500 truncate">{auction.sellerStoreName}</p>
          )}
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            {auction.bidCount != null && (
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> {auction.bidCount} bid{auction.bidCount === 1 ? '' : 's'}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {auction.status === 'LIVE'
                ? urgent
                  ? `Ends in ${shortDuration(remaining)}`
                  : `Ends ${formatDateTime(auction.endsAt)}`
                : formatDateTime(auction.endsAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            {sold ? 'Sold for' : 'Current price'}
          </p>
          <p className="font-mono text-lg font-bold text-amber-400">
            {formatMoney(sold ? auction.finalPrice : auction.currentPrice)}
          </p>
        </div>
        {reserve && <span className={`text-[11px] font-semibold ${reserve.tone}`}>{reserve.text}</span>}
      </div>

      {bid && (
        <div className="pt-2 border-t border-slate-800 text-[11px] space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Your maximum</span>
            <span className="font-mono text-slate-200">{formatMoney(bid.maximumBid)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">You are committed to</span>
            <span className="font-mono text-slate-200">{formatMoney(bid.effectiveBid)}</span>
          </div>
        </div>
      )}

      {footer}
    </Link>
  );
}
