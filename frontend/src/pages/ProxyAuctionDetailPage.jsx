import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  Gavel,
  Loader2,
  Store,
  Trophy,
  Undo2,
} from 'lucide-react';
import { auctionApi, AUCTION_POLL_MS } from '../api/auctionApi';
import { apiErrorMessage } from '../api/groupBuyApi';
import { useAuth } from '../context/AuthContext';
import useLiveReload, { topics } from '../components/groupbuy/useLiveReload';
import { formatMoney, formatDateTime, timeAgo } from '../components/groupbuy/format';
import { AuctionStatusBadge } from '../components/proxyAuction/AuctionStatusBadge';
import PlaceProxyBidModal from '../components/proxyAuction/PlaceProxyBidModal';
import { reserveLine, secondsRemaining } from '../components/proxyAuction/proxyAuctionMeta';
import { shortDuration } from '../components/proxyAuction/ProxyAuctionCard';

/**
 * One auction, end to end: the lot, the live price, the public bid ladder, and the signed-in
 * customer's own position.
 *
 * The public half and the private half are deliberately separate fetches. `getMyBid` is the only
 * call that can return a maximum, and it is only ever issued for the signed-in customer, so a
 * signed-out visitor cannot learn anybody's ceiling even by reading the network tab.
 */
export default function ProxyAuctionDetailPage() {
  const { auctionId } = useParams();
  const { isAuthenticated } = useAuth();

  const [auction, setAuction] = useState(null);
  const [history, setHistory] = useState([]);
  const [myBid, setMyBid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [showBidModal, setShowBidModal] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const loadPublic = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        const [detail, ladder] = await Promise.all([
          auctionApi.getAuction(auctionId),
          auctionApi.getBidHistory(auctionId),
        ]);
        setAuction(detail);
        setHistory(Array.isArray(ladder) ? ladder : []);
        setError(null);
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not load this auction.'));
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [auctionId],
  );

  const loadMyBid = useCallback(async () => {
    if (!isAuthenticated) {
      setMyBid(null);
      return;
    }
    try {
      setMyBid(await auctionApi.getMyBid(auctionId));
    } catch {
      // No bid on this auction is the normal case, not a failure worth showing.
      setMyBid(null);
    }
  }, [auctionId, isAuthenticated]);

  useEffect(() => {
    loadPublic(true);
  }, [loadPublic]);

  useEffect(() => {
    loadMyBid();
  }, [loadMyBid]);

  useLiveReload([topics.AUCTION, topics.STOREFRONT], () => {
    loadPublic(false);
    loadMyBid();
  });

  const placeBid = async (payload) => {
    setActionError(null);
    try {
      const placed = await auctionApi.placeBid(auctionId, payload);
      setMyBid(placed);
      await loadPublic(false);
      return true;
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Could not place your bid.'));
      throw err;
    }
  };

  const withdraw = async () => {
    setWithdrawing(true);
    setActionError(null);
    try {
      await auctionApi.withdrawBid(myBid.id);
      setMyBid(null);
      await loadPublic(false);
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Could not withdraw your bid.'));
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error || 'This auction does not exist.'}
        </div>
        <Link to="/auctions" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to auctions
        </Link>
      </div>
    );
  }

  const remaining = secondsRemaining(auction);
  const reserve = reserveLine(auction);
  const live = auction.status === 'LIVE' && auction.acceptingBids;
  const sold = auction.status === 'SOLD';
  const canBid = isAuthenticated && live;
  const canWithdraw =
    myBid && auction.status === 'LIVE' && ['WINNING', 'OUTBID'].includes(myBid.status);

  return (
    <div className="space-y-5">
      <Link to="/auctions" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">
        <ArrowLeft className="w-3.5 h-3.5" /> All auctions
      </Link>

      {actionError && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {actionError}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr] items-start">
        <div className="space-y-5">
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex gap-4">
              <div className="w-28 h-28 rounded-2xl bg-slate-800/80 overflow-hidden shrink-0 flex items-center justify-center">
                {auction.productImageUrl ? (
                  <img
                    src={auction.productImageUrl}
                    alt={auction.productName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Gavel className="w-8 h-8 text-slate-600" />
                )}
              </div>
              <div className="min-w-0 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h1 className="text-lg font-extrabold text-white">{auction.productName}</h1>
                  <AuctionStatusBadge status={auction.status} />
                </div>
                {auction.sellerStoreName && (
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5" /> {auction.sellerStoreName}
                  </p>
                )}
                {auction.description && (
                  <p className="text-xs text-slate-400 leading-relaxed">{auction.description}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Metric label="Current price" value={formatMoney(auction.currentPrice)} accent />
              <Metric label="Starting price" value={formatMoney(auction.startingPrice)} />
              <Metric label="Minimum increment" value={formatMoney(auction.minimumBidIncrement)} />
              <Metric label="Bids" value={String(auction.bidCount ?? 0)} />
            </div>

            {auction.closeNote && (
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-1">
                <p className="text-xs text-slate-300">{auction.closeNote}</p>
                {auction.closeCodeLabel && (
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{auction.closeCodeLabel}</p>
                )}
              </div>
            )}

            {sold && auction.finalPrice != null && (
              <div className="p-4 bg-amber-950/40 border border-amber-800 rounded-2xl flex items-start gap-3">
                <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-xs text-amber-200 font-semibold">
                    Sold for {formatMoney(auction.finalPrice)} per unit
                  </p>
                  {auction.winnerAlias && (
                    <p className="text-[11px] text-amber-300/70">Winning bidder: {auction.winnerAlias}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Gavel className="w-4 h-4 text-amber-400" /> Bid history
              </h2>
              <span className="text-[10px] text-slate-500">
                Amounts are what each bidder is committed to, never their maximum
              </span>
            </div>

            {history.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No bids yet. The lot is still at its opening price.
              </p>
            ) : (
              <div className="space-y-2">
                {history.map((entry) => (
                  <div
                    key={entry.sequence}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
                      entry.leading
                        ? 'bg-emerald-950/30 border-emerald-800'
                        : 'bg-slate-900/40 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[10px] text-slate-500 w-5 shrink-0">#{entry.sequence}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-200 truncate">
                          {entry.bidderAlias}
                          {entry.leading ? (
                            <span className="ml-2 px-1.5 py-0.5 bg-emerald-900 text-emerald-300 text-[9px] font-bold rounded uppercase">
                              Leading
                            </span>
                          ) : (
                            <span className="ml-2 px-1.5 py-0.5 bg-slate-800 text-slate-400 text-[9px] font-bold rounded uppercase">
                              Outbid
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {timeAgo(entry.placedAt)} &middot; {formatDateTime(entry.placedAt)}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-sm text-amber-400 shrink-0">{formatMoney(entry.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-6">
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                {live ? 'Ends in' : 'Closed'}
              </p>
              <p
                className={`font-mono text-2xl font-bold ${
                  live && remaining < 3600 ? 'text-rose-400' : 'text-white'
                }`}
              >
                {live ? shortDuration(remaining) : formatDateTime(auction.endedAt || auction.endsAt)}
              </p>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> {formatDateTime(auction.endsAt)}
              </p>
            </div>

            {reserve && (
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-2xl text-[11px] text-slate-400">
                <p>
                  This lot has a reserve price. Its value is never disclosed, only whether it has been met.
                </p>
                <p className={`mt-1 font-semibold ${reserve.tone}`}>{reserve.text}</p>
              </div>
            )}

            <div className="space-y-1.5 text-xs">
              <Row label="Minimum acceptable bid" value={formatMoney(auction.minimumNextBid)} />
              <Row label="Quantity in this lot" value={String(auction.quantity)} />
              <Row label="Distinct bidders" value={String(auction.bidderCount ?? 0)} />
              <Row label="Opens" value={formatDateTime(auction.startsAt)} />
            </div>

            {canBid ? (
              <button
                onClick={() => setShowBidModal(true)}
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-bold text-sm"
              >
                {myBid ? 'Adjust Your Bid' : 'Place a Bid'}
              </button>
            ) : !isAuthenticated ? (
              <Link
                to="/login"
                state={{ from: `/auctions/${auction.id}` }}
                className="block text-center py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-sm"
              >
                Sign in to bid
              </Link>
            ) : (
              <p className="text-[11px] text-slate-500 text-center py-2 border border-slate-800 rounded-xl">
                This auction is not accepting bids.
              </p>
            )}
          </div>

          {myBid && (
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">Your bid</h2>
                <AuctionStatusBadge status={myBid.status} kind="bid" />
              </div>
              <div className="space-y-1.5 text-xs">
                <Row label="Your maximum (private)" value={formatMoney(myBid.maximumBid)} />
                <Row
                  label={myBid.winning ? 'You are committed to' : 'You were committed to'}
                  value={formatMoney(myBid.effectiveBid)}
                />
                <Row label="Current price" value={formatMoney(myBid.currentPrice)} />
                {myBid.amountPaid != null && <Row label="Paid" value={formatMoney(myBid.amountPaid)} />}
              </div>
              {myBid.status === 'OUTBID' && auction.status === 'LIVE' && (
                <p className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-900 rounded-xl p-2 leading-relaxed">
                  Somebody outbid you. Your maximum of {formatMoney(myBid.maximumBid)} is still
                  authorised, but you would need at least {formatMoney(auction.minimumNextBid)} to take
                  the lead back.
                </p>
              )}
              {canWithdraw && (
                <button
                  onClick={withdraw}
                  disabled={withdrawing}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  {withdrawing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Undo2 className="w-3.5 h-3.5" />
                  )}
                  Withdraw my bid
                </button>
              )}
              {myBid.orderNumber && (
                <Link
                  to={`/orders/confirmation/${myBid.orderNumber}`}
                  className="block text-center py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
                >
                  View order {myBid.orderNumber}
                </Link>
              )}
            </div>
          )}

          <div className="glass-card p-4 rounded-3xl border border-slate-800 text-[11px] text-slate-500 space-y-1.5">
            <p className="font-semibold text-slate-300">How proxy bidding works</p>
            <p>Bid the most you would pay. We raise the price only against a real rival.</p>
            <p>The winner is the highest authorised bidder, paying the second-highest plus one increment.</p>
            <p>Nobody ever sees a maximum, and the server re-checks the price and the clock itself.</p>
          </div>
        </div>
      </div>

      <PlaceProxyBidModal
        isOpen={showBidModal}
        onClose={() => setShowBidModal(false)}
        auction={auction}
        currentMaximum={myBid?.maximumBid}
        onPlaced={placeBid}
      />
    </div>
  );
}

function Metric({ label, value, accent = false }) {
  return (
    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`font-mono text-sm font-bold ${accent ? 'text-amber-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-200 text-right">{value}</span>
    </div>
  );
}
