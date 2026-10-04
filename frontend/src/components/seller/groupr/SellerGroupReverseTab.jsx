import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, BadgeCheck, Gavel, Loader2, Send, XCircle } from 'lucide-react';
import { sellerGroupReverseApi } from '../../../api/groupReverseApi';
import useLiveReload, { topics } from '../../groupbuy/useLiveReload';
import { apiErrorMessage } from '../../../api/groupBuyApi';
import { formatDateTime, formatMoney } from '../../groupbuy/format';
import { OfferStatusBadge } from '../../groupr/GroupReverseOfferCard';

const inputClass =
  'w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:border-indigo-600 focus:outline-none';

const emptyBid = { unitPrice: '', offeredQuantity: '', deliveryFee: '0', estimatedDeliveryDays: '3', warrantyMonths: '0', message: '' };

/**
 * Formats an instant as a local wall-clock "YYYY-MM-DDTHH:mm:ss" string. The offer expiry is a
 * LocalDateTime on the server, so it has to be sent without a zone: toISOString() would shift it by
 * the UTC offset and a group closing soon would be read as already expired.
 */
const toLocalDateTime = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/**
 * The seller side of a customer-driven buying group.
 *
 * A seller here is not offering a deal to customers - customers have already put their own money
 * behind a quantity. The seller is quoting to win the whole block. That is why the unit price is
 * compared against the group's target and why a bid has to cover every unit at once.
 */
export default function SellerGroupReverseTab() {
  const [view, setView] = useState('available');
  const [demands, setDemands] = useState([]);
  const [myOffers, setMyOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const [quoting, setQuoting] = useState(null);
  const [bid, setBid] = useState(emptyBid);
  const [bidError, setBidError] = useState('');

  const load = useCallback(async () => {
    try {
      const [available, mine] = await Promise.all([
        sellerGroupReverseApi.getAvailableDemands(),
        sellerGroupReverseApi.getMyOffers(),
      ]);
      setDemands(available ?? []);
      setMyOffers(mine ?? []);
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

  // Must be a top-level hook call: useLiveReload itself calls hooks, and calling it from
  // inside the effect above threw "Invalid hook call" and blanked the whole seller page.
  useLiveReload([topics.GROUP_REVERSE, topics.SELLER_ACCOUNT], load);

  const openQuote = (demand) => {
    setQuoting(demand);
    // Pre-fill from the group's own numbers so the seller is nudged towards the target price.
    setBid({
      ...emptyBid,
      unitPrice: String(demand.targetPrice ?? ''),
      offeredQuantity: String(demand.committedQuantity ?? demand.requiredQuantity ?? ''),
    });
    setBidError('');
    setNotice('');
  };

  const submitBid = async () => {
    if (!bid.unitPrice || Number(bid.unitPrice) <= 0) {
      setBidError('Enter a unit price above zero.');
      return;
    }
    if (Number(bid.offeredQuantity) < Number(quoting.requiredQuantity)) {
      setBidError(`You have to cover the whole group: ${quoting.requiredQuantity} unit(s).`);
      return;
    }
    if (quoting.maxPrice != null && Number(bid.unitPrice) > Number(quoting.maxPrice)) {
      setBidError(
        `This group will not look at offers above ${formatMoney(quoting.maxPrice)} per unit.`,
      );
      return;
    }
    setBusy(true);
    setBidError('');
    try {
      // The group caps how long an offer may stay open, so default to just before their deadline.
      const expiry = toLocalDateTime(
        new Date(new Date(quoting.offerDeadline).getTime() - 60 * 60 * 1000),
      );
      await sellerGroupReverseApi.submitOffer(quoting.id, {
        unitPrice: Number(bid.unitPrice),
        offeredQuantity: Number(bid.offeredQuantity),
        deliveryFee: Number(bid.deliveryFee) || 0,
        estimatedDeliveryDays: Number(bid.estimatedDeliveryDays) || 1,
        warrantyMonths: Number(bid.warrantyMonths) || 0,
        offerExpiry: expiry,
        message: bid.message.trim() || null,
      });
      setQuoting(null);
      setNotice('Your offer is in. The group leader decides - you will hear back either way.');
      await load();
    } catch (err) {
      setBidError(apiErrorMessage(err, 'Could not submit your offer.'));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (offerId) => {
    if (!window.confirm('Withdraw this offer? The group leader will stop seeing it as selectable.'))
      return;
    setBusy(true);
    try {
      await sellerGroupReverseApi.withdrawOffer(offerId);
      setNotice('Offer withdrawn.');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not withdraw the offer.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (quoting) {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => setQuoting(null)}
          className="text-xs font-semibold text-slate-400 hover:text-white"
        >
          ← Back to available groups
        </button>

        <header className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-2">
          <h2 className="text-lg font-extrabold text-white">Quote for {quoting.productName}</h2>
          <p className="text-sm text-slate-400">{quoting.description}</p>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
            {[
              ['Units to cover', quoting.requiredQuantity],
              ['Committed', quoting.committedQuantity],
              ['Target price', formatMoney(quoting.targetPrice)],
              ['Ceiling', formatMoney(quoting.maxPrice)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-500">{label}</dt>
                <dd className="text-white font-bold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="pt-2 text-[11px] text-slate-500">
            You are bidding for the whole block, not per unit sold. Stock is only taken from you if
            the leader chooses your offer, and then the full quantity at once.
          </p>
        </header>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5" htmlFor="bid-price">
                Your unit price
              </label>
              <input
                id="bid-price"
                type="number"
                min={0}
                step="0.01"
                value={bid.unitPrice}
                onChange={(event) => setBid({ ...bid, unitPrice: event.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5" htmlFor="bid-qty">
                Units you will cover
              </label>
              <input
                id="bid-qty"
                type="number"
                min={quoting.requiredQuantity}
                value={bid.offeredQuantity}
                onChange={(event) => setBid({ ...bid, offeredQuantity: event.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5" htmlFor="bid-fee">
                Delivery fee for the group
              </label>
              <input
                id="bid-fee"
                type="number"
                min={0}
                step="0.01"
                value={bid.deliveryFee}
                onChange={(event) => setBid({ ...bid, deliveryFee: event.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5" htmlFor="bid-days">
                Delivery in (days)
              </label>
              <input
                id="bid-days"
                type="number"
                min={1}
                value={bid.estimatedDeliveryDays}
                onChange={(event) => setBid({ ...bid, estimatedDeliveryDays: event.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5" htmlFor="bid-warranty">
                Warranty (months)
              </label>
              <input
                id="bid-warranty"
                type="number"
                min={0}
                value={bid.warrantyMonths}
                onChange={(event) => setBid({ ...bid, warrantyMonths: event.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5" htmlFor="bid-message">
              Message to the group (optional)
            </label>
            <textarea
              id="bid-message"
              rows={2}
              value={bid.message}
              onChange={(event) => setBid({ ...bid, message: event.target.value })}
              className={inputClass}
            />
          </div>

          {bidError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" /> {bidError}
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={submitBid}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit the offer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {[
          { id: 'available', label: `Groups to quote (${demands.length})` },
          { id: 'mine', label: `My offers (${myOffers.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              view === tab.id
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800/60 text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-sm">
          <BadgeCheck className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      {view === 'available' ? (
        demands.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">
            No groups are ready to quote right now. A group only appears once enough customers have
            committed to its full quantity.
          </p>
        ) : (
          <div className="space-y-3">
            {demands.map((demand) => (
              <div
                key={demand.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{demand.productName}</h3>
                    <p className="text-[11px] text-slate-500">
                      {demand.description ?? 'No description given.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openQuote(demand)}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                  >
                    <Gavel className="w-3.5 h-3.5" /> Quote
                  </button>
                </div>

                <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  {[
                    ['Units needed', demand.requiredQuantity],
                    ['Members', demand.memberCount],
                    ['Target price', formatMoney(demand.targetPrice)],
                    ['Ceiling', formatMoney(demand.maxPrice)],
                    ['Deliver to', demand.deliveryCity ?? 'Anywhere'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="text-white font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>

                <p className="text-[11px] text-slate-500">
                  Bids close {formatDateTime(demand.offerDeadline)} · you see the group, never who is
                  in it.
                </p>
              </div>
            ))}
          </div>
        )
      ) : myOffers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">
          You have not quoted any group yet.
        </p>
      ) : (
        <div className="space-y-3">
          {myOffers.map((offer) => (
            <div
              key={offer.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{offer.productName}</h3>
                  <p className="text-[11px] text-slate-500">
                    Covering {offer.requiredQuantity} unit(s) · submitted{' '}
                    {formatDateTime(offer.createdAt)}
                  </p>
                </div>
                <OfferStatusBadge status={offer.status} />
              </div>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {[
                  ['Unit price', formatMoney(offer.unitPrice)],
                  ['Group total', formatMoney(offer.groupTotal)],
                  ['Per unit incl. freight', formatMoney(offer.effectiveUnitPriceIncludingDelivery)],
                  ['Meets target', offer.meetsTargetPrice ? 'Yes' : 'No'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="text-white font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              {offer.status === 'SUBMITTED' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => withdraw(offer.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:border-rose-700 hover:text-rose-300 disabled:opacity-50 text-xs font-bold"
                >
                  <XCircle className="w-3.5 h-3.5" /> Withdraw
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
