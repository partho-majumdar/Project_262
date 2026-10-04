import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, CreditCard, Gavel, Loader2, MapPin, Shield, X } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import { apiErrorMessage } from '../../api/groupBuyApi';
import { formatMoney, formatDateTime } from '../groupbuy/format';
import AddressSelectorModal from '../common/AddressSelectorModal';
import { AUCTION_PAYMENT_METHODS } from '../../api/auctionApi';

/**
 * Collects a customer's private maximum and hands it to the server.
 *
 * The wording matters as much as the mechanics: the number typed here is an authorisation, not a
 * price. The customer is told up front that the public price will be lower - or equal - and that
 * nobody, including the seller, will ever see this figure.
 */
export default function PlaceProxyBidModal({ isOpen, onClose, auction, currentMaximum, onPlaced }) {
  const [maximum, setMaximum] = useState('');
  const [addresses, setAddresses] = useState([]);
  const [address, setAddress] = useState(null);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CREDIT_CARD');
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const minimum = Number(auction?.minimumNextBid ?? 0);
  const currentPrice = Number(auction?.currentPrice ?? 0);

  // A first-time bidder has nothing to raise, so the box starts at the minimum the server will
  // accept. Somebody already in gets their existing ceiling back, ready to adjust.
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setMaximum(currentMaximum ? String(currentMaximum) : minimum ? String(minimum) : '');
  }, [isOpen, currentMaximum, minimum]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const load = async () => {
      setLoadingAddresses(true);
      try {
        const res = await axiosClient.get('/users/addresses');
        const payload = res?.data ?? res;
        const list = Array.isArray(payload) ? payload : Array.isArray(payload?.content) ? payload.content : [];
        if (cancelled) return;
        setAddresses(list);
        const preferred = list.find((a) => a.isDefault) || list[0] || null;
        setAddress((current) => current || preferred);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Could not load your saved addresses.'));
      } finally {
        if (!cancelled) setLoadingAddresses(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const parsed = Number(maximum);
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed >= minimum;

  // Raising a ceiling is the only change the server accepts, so an existing bid cannot re-submit the
  // same figure. Checking it here turns a guaranteed round-trip rejection into instant feedback.
  const mustExceed = Number(currentMaximum ?? 0);
  const aboveExisting = !currentMaximum || parsed > mustExceed;

  // What the customer would be committed to right now: the public price, unless their own ceiling
  // is lower, in which case they are not leading and are committed to no more than they authorised.
  // The server settles the real figure, which is why this stays labelled as an estimate.
  const preview = useMemo(() => {
    if (!valid) return null;
    if (currentMaximum && parsed <= mustExceed) return null;
    return Math.min(parsed, currentPrice);
  }, [valid, parsed, currentPrice, currentMaximum, mustExceed]);

  if (!isOpen) return null;

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (!valid) {
      setError(`Enter a maximum of at least ${formatMoney(minimum)}.`);
      return;
    }
    if (!aboveExisting) {
      setError(
        `Your new maximum must be higher than the ${formatMoney(currentMaximum)} you already authorised.`,
      );
      return;
    }
    if (!address) {
      setError('Choose where the lot should be delivered if you win.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await onPlaced({
        maximumBid: parsed,
        quantity: 1,
        addressId: address.id,
        paymentMethod,
      });
      if (result !== false) onClose?.();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not place your bid.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-lg p-6 rounded-3xl space-y-5 relative max-h-[90vh] overflow-y-auto border border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Gavel className="w-5 h-5 text-amber-400" /> {currentMaximum ? 'Adjust Your Bid' : 'Place a Bid'}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-2xl text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Current price</span>
              <span className="font-mono text-white">{formatMoney(currentPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Minimum acceptable bid</span>
              <span className="font-mono text-amber-400">{formatMoney(minimum)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Lot closes</span>
              <span className="text-slate-300">{formatDateTime(auction?.endsAt)}</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-300">Your maximum bid *</label>
            <input
              type="number"
              step="0.01"
              min={minimum}
              value={maximum}
              onChange={(e) => setMaximum(e.target.value)}
              placeholder={minimum ? String(minimum) : '0.00'}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-amber-500"
              required
            />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              This is a ceiling, not the price you pay. GroupMart bids on your behalf, one small
              increment at a time, and only as far as a rival actually forces it.
            </p>
            {currentMaximum != null && (
              <p className="text-[11px] text-slate-500 leading-relaxed">
                You have already authorised {formatMoney(currentMaximum)} on this auction, so your new
                maximum has to be higher than that.
              </p>
            )}
          </div>

          {preview !== null && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-900 rounded-2xl space-y-1">
              <div className="flex justify-between">
                <span className="text-emerald-300/80">You would be committed to right now</span>
                <span className="font-mono text-emerald-300 font-bold">{formatMoney(preview)}</span>
              </div>
              {parsed > preview && (
                <p className="text-[11px] text-emerald-400/70">
                  Not spending {formatMoney(parsed - preview)} of it. It stays available if someone bids
                  against you.
                </p>
              )}
            </div>
          )}

          {valid && !aboveExisting && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-2xl text-rose-300 flex items-start gap-2 text-[11px]">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Enter more than {formatMoney(currentMaximum)}, the maximum you already authorised.
              </span>
            </div>
          )}

          <div className="p-3 bg-amber-950/30 border border-amber-900/60 rounded-2xl flex items-start gap-2">
            <Shield className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
              Your maximum is private. No other bidder, and not even the seller, can see it. The
              public price and the bid history reveal only the amount you are committed to.
            </p>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-300">Delivery address *</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddressPicker(true)}
                className="flex-1 text-left px-3 py-2 bg-slate-900 border border-slate-800 hover:border-amber-500 rounded-xl text-slate-200 flex items-center gap-2"
              >
                {loadingAddresses ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                ) : (
                  <MapPin className="w-4 h-4 text-amber-400" />
                )}
                <span className="truncate">
                  {address
                    ? `${address.fullName || 'Address'} - ${address.city || ''} ${address.state || ''}`.trim()
                    : 'Choose a delivery address'}
                </span>
              </button>
              {address && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
            </div>
            {addresses.length === 0 && !loadingAddresses && (
              <p className="text-[11px] text-slate-500">No saved addresses yet - add one in the picker.</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-300 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-indigo-400" /> Payment method
            </label>
            <div className="flex flex-wrap gap-2">
              {AUCTION_PAYMENT_METHODS.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setPaymentMethod(method.id)}
                  className={`px-3 py-1.5 rounded-xl font-semibold border transition-all ${
                    paymentMethod === method.id
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500">Sandbox payment. No real money is charged.</p>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded-xl font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingAddresses || !valid || !aboveExisting}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl font-semibold"
            >
              {submitting ? 'Placing...' : currentMaximum ? 'Update Bid' : 'Place Bid'}
            </button>
          </div>
        </form>
      </div>

      <AddressSelectorModal
        isOpen={showAddressPicker}
        onClose={() => setShowAddressPicker(false)}
        selectedAddressId={address?.id}
        onSelectAddress={(picked) => {
          setAddress(picked);
          setShowAddressPicker(false);
        }}
      />
    </div>
  );
}
