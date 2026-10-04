import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Gavel, Package, RefreshCw, Target, XCircle } from 'lucide-react';
import { adminReverseGroupBuyingApi } from '../../../api/reverseGroupBuyingApi';
import { adminAuctionApi } from '../../../api/groupBuyingAuctionApi';
import { apiErrorMessage } from '../../../api/groupBuyApi';
import { listOf } from '../groupbuy/adminUi';
import { formatDateTime, formatMoney } from '../../groupbuy/format';
import { RgbStatusBadge } from '../../reverse/RgbStatusBadge';
import { AuctionStatusBadge } from '../../auction/AuctionStatusBadge';
import { describeRgbTarget } from '../../reverse/reverseMeta';

/**
 * Platform oversight for the two collective purchasing mechanisms that sit alongside CWP. Admin can
 * read every offer and auction and force-close anything that is going wrong, which refunds every
 * customer commitment on the server.
 */
export default function AdminCollectiveTab() {
  const [view, setView] = useState('reverse');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-5">
      <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">Collective purchasing oversight</h2>
            <p className="text-xs text-slate-400">
              Reverse Group Buying demand targets and Group Buying Auctions. Force-closing refunds every
              customer commitment and releases the reserved stock.
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
          {[
            { id: 'reverse', label: 'Reverse offers', icon: Target },
            { id: 'auctions', label: 'Auctions', icon: Gavel },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                view === id ? 'bg-rose-600 text-white shadow-lg' : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </nav>
      </div>

      {view === 'reverse' && <AdminReverseOffers refreshKey={refreshKey} />}
      {view === 'auctions' && <AdminAuctions refreshKey={refreshKey} />}
    </div>
  );
}

function useForceClose(closer, onChanged) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const forceClose = async (id, label) => {
    const reason = window.prompt(`Force-close "${label}"? Every customer commitment is refunded.`, 'Administrative closure');
    if (reason === null) return;
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      await closer(id, reason);
      setNotice(`"${label}" was force-closed and all commitments refunded.`);
      onChanged?.();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return { error, notice, busyId, forceClose };
}

function Banner({ error, notice }) {
  if (error) {
    return (
      <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> {error}
      </div>
    );
  }
  if (notice) {
    return (
      <div className="p-3 rounded-2xl bg-emerald-950/50 border border-emerald-800 text-emerald-200 text-xs">
        {notice}
      </div>
    );
  }
  return null;
}

function AdminReverseOffers({ refreshKey }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminReverseGroupBuyingApi.getOffers();
      setOffers(listOf(data));
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load reverse group buying offers'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const { error: actionError, notice, busyId, forceClose } = useForceClose(
    adminReverseGroupBuyingApi.forceCloseOffer,
    load
  );

  return (
    <div className="space-y-4">
      <Banner error={error || actionError} notice={notice} />
      <div className="glass-card rounded-3xl border border-slate-800 overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-slate-400 text-xs">Loading reverse offers…</p>
        ) : offers.length === 0 ? (
          <p className="p-8 text-center text-slate-400 text-xs">No reverse group buying offers exist.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 uppercase font-bold">
                <tr>
                  <th className="p-4">Product</th>
                  <th className="p-4">Seller</th>
                  <th className="p-4">Condition</th>
                  <th className="p-4">Demand</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {offers.map((offer) => (
                  <tr key={offer.id} className="hover:bg-slate-900/40">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-800 overflow-hidden border border-slate-700 flex items-center justify-center shrink-0">
                          {offer.productImageUrl ? (
                            <img src={offer.productImageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-4 h-4 text-slate-500" />
                          )}
                        </div>
                        <span className="font-bold text-white">{offer.productName}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-400">{offer.sellerStoreName}</td>
                    <td className="p-4 text-cyan-300">{describeRgbTarget(offer)}</td>
                    <td className="p-4 font-mono">
                      {offer.currentDemand}/{offer.targetQuantity} · {formatMoney(offer.unlockedUnitPrice)}
                    </td>
                    <td className="p-4">
                      <RgbStatusBadge status={offer.status} />
                      <span className="block text-[10px] text-slate-500 mt-1">
                        {formatDateTime(offer.participationDeadline)}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {!['COMPLETED', 'CLOSED', 'FAILED', 'CANCELLED'].includes(offer.status) && (
                        <button
                          onClick={() => forceClose(offer.id, offer.productName)}
                          disabled={busyId === offer.id}
                          className="px-3 py-1.5 rounded-xl border border-rose-800 text-rose-300 hover:bg-rose-950 text-[11px] font-bold disabled:opacity-50"
                        >
                          Force close
                        </button>
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

function AdminAuctions({ refreshKey }) {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminAuctionApi.getAuctions();
      setAuctions(listOf(data));
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load group buying auctions'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const { error: actionError, notice, busyId, forceClose } = useForceClose(adminAuctionApi.forceCancel, load);

  return (
    <div className="space-y-4">
      <Banner error={error || actionError} notice={notice} />
      <div className="glass-card rounded-3xl border border-slate-800 overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-slate-400 text-xs">Loading auctions…</p>
        ) : auctions.length === 0 ? (
          <p className="p-8 text-center text-slate-400 text-xs">No group buying auctions exist.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 uppercase font-bold">
                <tr>
                  <th className="p-4">Product</th>
                  <th className="p-4">Seller</th>
                  <th className="p-4">Pricing rule</th>
                  <th className="p-4">Bids</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {auctions.map((auction) => (
                  <tr key={auction.id} className="hover:bg-slate-900/40">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-800 overflow-hidden border border-slate-700 flex items-center justify-center shrink-0">
                          {auction.productImageUrl ? (
                            <img src={auction.productImageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Gavel className="w-4 h-4 text-slate-500" />
                          )}
                        </div>
                        <span className="font-bold text-white">{auction.productName}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-400">{auction.sellerStoreName}</td>
                    <td className="p-4 text-slate-400">
                      {auction.pricingRule === 'COLLECTIVE_QUANTITY_DISCOUNT'
                        ? `${Number(auction.discountPercent)}% off`
                        : `${(auction.tiers || []).length} tier(s)`}
                      <span className="block text-[10px] text-slate-500">
                        from {formatMoney(auction.startingPrice)}
                      </span>
                    </td>
                    <td className="p-4 font-mono">
                      {auction.collectiveQuantity}/{auction.minimumCollectiveQuantity} units
                      <span className="block text-[10px] text-slate-500">
                        {auction.participantCount} bidder{auction.participantCount === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className="p-4">
                      <AuctionStatusBadge status={auction.status} />
                      <span className="block text-[10px] text-slate-500 mt-1">{formatDateTime(auction.endsAt)}</span>
                    </td>
                    <td className="p-4 text-right">
                      {!['COMPLETED', 'FAILED', 'CANCELLED'].includes(auction.status) && (
                        <button
                          onClick={() => forceClose(auction.id, auction.productName)}
                          disabled={busyId === auction.id}
                          className="px-3 py-1.5 rounded-xl border border-rose-800 text-rose-300 hover:bg-rose-950 text-[11px] font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Force cancel
                        </button>
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
