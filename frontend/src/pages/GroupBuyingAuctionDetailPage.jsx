import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Gavel,
  Loader2,
  Package,
  ShieldCheck,
  Store,
  Users,
  XCircle,
} from 'lucide-react';
import { groupBuyingAuctionApi } from '../api/groupBuyingAuctionApi';
import { apiErrorMessage } from '../api/groupBuyApi';
import { useAuth } from '../context/AuthContext';
import useLiveReload, { topics } from '../components/groupbuy/useLiveReload';
import CountdownTimer from '../components/groupbuy/CountdownTimer';
import AuctionPriceLadder from '../components/auction/AuctionPriceLadder';
import PlaceBidModal from '../components/auction/PlaceBidModal';
import { AuctionStatusBadge } from '../components/auction/AuctionStatusBadge';
import { auctionAcceptsBids, isAuctionTerminal } from '../components/auction/auctionMeta';
import { formatDateTime, formatMoney } from '../components/groupbuy/format';

export default function GroupBuyingAuctionDetailPage() {
  const { auctionId } = useParams();
  const { isAuthenticated } = useAuth();
  const [auction, setAuction] = useState(null);
  const [result, setResult] = useState(null);
  const [myBids, setMyBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [flash, setFlash] = useState('');

  const load = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        const data = await groupBuyingAuctionApi.getAuction(auctionId);
        setAuction(data);
        setError('');
        if (data?.finalized) {
          // A locked result only exists after finalization, so absence here is normal.
          groupBuyingAuctionApi
            .getResult(auctionId)
            .then(setResult)
            .catch(() => setResult(null));
        } else {
          setResult(null);
        }
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not load this auction.'));
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [auctionId]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  // The customer's own bids on this lot, so the page can show their bid and its WON/OUTBID outcome.
  // Filtered client-side from the existing "my participations" list rather than adding an endpoint.
  useEffect(() => {
    if (!isAuthenticated) {
      setMyBids([]);
      return;
    }
    let cancelled = false;
    const loadMine = () =>
      groupBuyingAuctionApi
        .getMyParticipations()
        .then((rows) => {
          if (cancelled) return;
          const mine = (Array.isArray(rows) ? rows : []).filter((row) => row.auctionId === auctionId);
          setMyBids(mine);
        })
        .catch(() => {
          if (!cancelled) setMyBids([]);
        });
    loadMine();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, auctionId]);

  useLiveReload([topics.GROUP_BUYING_AUCTION, topics.STOREFRONT], () => load(false));

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error || 'Auction not found.'}
        </div>
        <Link
          to="/group-buying-auctions"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to auctions
        </Link>
      </div>
    );
  }

  const failed = auction.status === 'FAILED';
  const accepts = auctionAcceptsBids(auction);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        to="/group-buying-auctions"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to auctions
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-5">
          <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
            <div className="aspect-[16/9] bg-slate-900">
              {auction.productImageUrl ? (
                <img src={auction.productImageUrl} alt={auction.productName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600">
                  <Package className="w-12 h-12" />
                </div>
              )}
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-extrabold text-white">{auction.productName}</h1>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                    <Store className="w-3 h-3" /> {auction.sellerStoreName}
                  </p>
                </div>
                <AuctionStatusBadge status={auction.status} />
              </div>

              {auction.description && <p className="text-xs text-slate-300 leading-relaxed">{auction.description}</p>}

              {auction.closeReasonLabel && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-400">
                  <span className="font-bold text-slate-300">{auction.closeReasonLabel}</span>
                  {auction.closeNote ? ` — ${auction.closeNote}` : ''}
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-5 rounded-3xl border border-slate-800 space-y-4">
            <h2 className="text-xs font-black uppercase text-amber-400 tracking-wider">Collective price ladder</h2>
            <p className="text-[11px] text-slate-400">
              {auction.collectiveQuantity} of {auction.minimumCollectiveQuantity} units bid so far
              {auction.remainingToMinimum > 0
                ? ` — ${auction.remainingToMinimum} more units to reach the minimum.`
                : ' — the minimum is met.'}
            </p>
            <AuctionPriceLadder auction={auction} />
            <p className="text-[10px] text-slate-500">
              The highlighted rung is a projection from the quantity bid so far. The price that is actually charged
              is calculated and locked by the server when the auction closes.
            </p>
          </div>

          {result && (
            <div className="glass-card p-5 rounded-3xl border border-emerald-800/60 bg-emerald-950/20 space-y-3">
              <h2 className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Final result
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <Metric label="Final price" value={formatMoney(result.finalUnitPrice)} />
                <Metric
                  label="Units sold"
                  value={`${result.winningQuantity ?? result.collectiveQuantity}`}
                />
                <Metric label="Bids won" value={`${result.winningBidCount}`} />
                <Metric label="Bids outbid" value={`${result.outbidCount}`} />
              </div>
              <p className="text-[11px] text-slate-500">
                Every winner paid {formatMoney(result.finalUnitPrice)} per unit, whatever their own maximum was. Of{' '}
                {result.collectiveQuantity} collectively bid units, {result.winningQuantity ?? result.collectiveQuantity}{' '}
                were sold and {result.outbidQuantity ?? 0} were outbid and released.
              </p>
              {result.totalSuccessfulSales != null && (
                <p className="text-[11px] text-slate-500">
                  Total successful sales: {formatMoney(result.totalSuccessfulSales)}.
                </p>
              )}
              <p className="text-[11px] text-slate-500">
                Finalized {formatDateTime(result.finalizedAt)}. Bids whose maximum was below{' '}
                {formatMoney(result.finalUnitPrice)} were outbid and refunded in full.
              </p>
            </div>
          )}

          {failed && (
            <div className="glass-card p-5 rounded-3xl border border-rose-800/60 bg-rose-950/20 space-y-2">
              <h2 className="text-xs font-black uppercase text-rose-400 tracking-wider flex items-center gap-1.5">
                <XCircle className="w-4 h-4" /> Minimum not met
              </h2>
              <p className="text-xs text-slate-300">
                Only {auction.collectiveQuantity} of {auction.minimumCollectiveQuantity} required units were bid, so
                the auction did not clear. Every bid was refunded in full and the stock was released.
              </p>
            </div>
          )}

          <div className="glass-card p-5 rounded-3xl border border-slate-800 space-y-3">
            <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider">How bidding works</h2>
            <p className="p-3 bg-amber-950/30 border border-amber-900/60 rounded-xl text-[11px] text-amber-200 leading-relaxed">
              <strong>Your maximum unit price is the highest price you are willing to pay. You may pay less if the
              final clearing price is lower. All eligible winners pay the same final clearing price.</strong>
            </p>
            <ol className="space-y-2 text-[11px] text-slate-400 list-decimal list-inside">
              <li>Bid a quantity and the maximum unit price you will accept for it.</li>
              <li>
                Your quantity counts toward the collective total. The unit price is derived from that total by the
                seller's pricing rule, never from an individual bidder.
              </li>
              <li>
                When the auction closes, one clearing price is locked. If it is at or below your maximum you get an
                order at that price. If it is above, your bid is outbid and refunded in full.
              </li>
              <li>
                Your quantity still counts toward the collective total that sets the price, even if you are outbid
                afterwards.
              </li>
              <li>You can withdraw a bid while the auction is still open.</li>
            </ol>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4 sticky top-24">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                {auction.finalized ? 'Final price' : 'Price if it closed now'}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-amber-400 font-mono">
                  {formatMoney(auction.finalized ? auction.finalUnitPrice : auction.projectedUnitPrice ?? auction.startingPrice)}
                </span>
                <span className="text-xs text-slate-500 line-through">{formatMoney(auction.startingPrice)}</span>
              </div>
            </div>

            <div className="space-y-2 text-[11px]">
              <Row label="Quantity bid" value={`${auction.collectiveQuantity} of ${auction.minimumCollectiveQuantity} units`} />
              <Row label="Still available" value={`${auction.remainingQuantity} units`} />
              <Row label="Bidders" value={`${auction.participantCount}`} />
              <Row label="Per bidder" value={`${auction.minQuantityPerCustomer}–${auction.maxQuantityPerCustomer} units`} />
              {auction.minimumSellerUnitPrice != null && (
                <Row label="Seller floor" value={formatMoney(auction.minimumSellerUnitPrice)} />
              )}
            </div>

            {auction.status === 'OPEN' && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Closes in
                </span>
                <CountdownTimer expiresAt={auction.endsAt} />
              </div>
            )}

            {myBids.length > 0 && (
              <div className="space-y-2 border-t border-slate-800 pt-4">
                <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Your bid here</h3>
                {myBids.map((bid) => (
                  <div
                    key={bid.id}
                    className={`p-3 rounded-xl border text-[11px] ${
                      bid.status === 'WON'
                        ? 'bg-emerald-950/30 border-emerald-800'
                        : bid.status === 'OUTBID'
                          ? 'bg-rose-950/30 border-rose-900'
                          : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-200">
                        {bid.quantity} unit{bid.quantity === 1 ? '' : 's'}
                      </span>
                      <span className="font-mono text-slate-400">
                        max {formatMoney(bid.maxUnitPrice)}
                      </span>
                    </div>
                    <p className="text-slate-400 mt-1">
                      {bid.status === 'WON' &&
                        result &&
                        `Won. You paid ${formatMoney(result.finalUnitPrice)} per unit, not your maximum.`}
                      {bid.status === 'OUTBID' &&
                        `Outbid: the final price of ${formatMoney(result?.finalUnitPrice)} was above your maximum. Refunded in full.`}
                      {bid.status === 'BID_PLACED' && 'Counting toward the collective quantity.'}
                      {bid.status === 'CANCELLED' && 'Withdrawn before the auction closed.'}
                      {bid.status === 'REFUNDED' && 'The auction did not reach its minimum, so this was refunded.'}
                    </p>
                    {bid.orderNumber && (
                      <p className="text-slate-500 font-mono mt-1">Order {bid.orderNumber}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isAuthenticated && accepts ? (
              <button
                type="button"
                onClick={() => setIsBidModalOpen(true)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-sm font-bold shadow-lg transition"
              >
                Place a bid
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-500" />
                {!isAuthenticated
                  ? 'Sign in to place a bid.'
                  : isAuctionTerminal(auction.status)
                    ? 'This auction is closed to new bids.'
                    : 'This auction is not open for bidding yet.'}
              </div>
            )}

            {flash && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-[11px] text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> {flash}
              </div>
            )}

            <p className="text-[10px] text-slate-500 flex items-start gap-1.5">
              <Users className="w-3 h-3 mt-0.5 shrink-0" />
              Opens {formatDateTime(auction.startsAt)} · closes {formatDateTime(auction.endsAt)}
            </p>
            <p className="text-[10px] text-slate-600 flex items-start gap-1.5">
              <Gavel className="w-3 h-3 mt-0.5 shrink-0" />
              You are never charged more than the maximum unit price you bid.
            </p>
          </div>
        </div>
      </div>

      <PlaceBidModal
        isOpen={isBidModalOpen}
        onClose={() => setIsBidModalOpen(false)}
        auction={auction}
        onSuccess={() => {
          setIsBidModalOpen(false);
          setFlash('Your bid is in and counted toward the collective quantity.');
          load(false);
        }}
      />
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
      <p className="text-base font-black font-mono text-white">{value}</p>
      <p className="text-[10px] text-slate-500 font-semibold">{label}</p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-bold text-right">{value}</span>
    </div>
  );
}
