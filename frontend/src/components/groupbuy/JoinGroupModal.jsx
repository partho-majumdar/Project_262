import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CreditCard, Loader2, MapPin, Minus, Plus, ShieldCheck, Users, X } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import AddressSelectorModal from '../common/AddressSelectorModal';
import { groupBuyApi, apiErrorMessage } from '../../api/groupBuyApi';
import { formatMoney, PAYMENT_METHODS, projectedUnitPrice } from './format';

const describeAddress = (address) =>
  [address.streetAddress, address.apartment, address.city, address.state, address.postalCode, address.country]
    .filter(Boolean)
    .join(', ');

export default function JoinGroupModal({ isOpen, onClose, mode = 'join', campaign, group, invitedByUserId, onSuccess }) {
  const [quantity, setQuantity] = useState(1);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CREDIT_CARD');
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setQuantity(1);

    const loadAddresses = async () => {
      setLoadingAddresses(true);
      try {
        const res = await axiosClient.get('/users/addresses');
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.data) ? res.data.data : [];
        setAddresses(list);
        setSelectedAddress((current) =>
          current && list.some((a) => a.id === current.id)
            ? current
            : list.find((a) => a.isDefault || a.default) || list[0] || null,
        );
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not load your saved addresses.'));
      } finally {
        setLoadingAddresses(false);
      }
    };
    loadAddresses();
  }, [isOpen]);

  const participantCount = mode === 'join' ? group?.participantCount ?? 0 : 0;
  const unitPrice = useMemo(
    () => projectedUnitPrice(campaign?.basePrice, campaign?.tiers, participantCount + 1),
    [campaign, participantCount],
  );

  if (!isOpen || !campaign) return null;

  const maxQuantity = Math.max(1, Math.min(campaign.maxQuantityPerUser ?? 1, campaign.availableQuantity ?? 1));
  const total = unitPrice * quantity;

  const handleSubmit = async () => {
    if (!selectedAddress) {
      setError('Add or select a shipping address to continue.');
      return;
    }
    setSubmitting(true);
    setError('');
    const payload = {
      quantity,
      addressId: selectedAddress.id,
      paymentMethod,
      ...(invitedByUserId ? { invitedByUserId } : {}),
    };
    try {
      const result =
        mode === 'start'
          ? await groupBuyApi.startGroup(campaign.id, payload)
          : await groupBuyApi.joinGroup(group.id, payload);
      onSuccess?.(result);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not complete your request.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
        <div className="glass-panel bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
          <div className="flex items-center justify-between p-5 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-nexus-400" />
                {mode === 'start' ? 'Start a new group' : 'Join this group'}
              </h2>
              <p className="text-[11px] text-slate-400 line-clamp-1">{campaign.title}</p>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Quantity */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Quantity</label>
              <div className="flex items-center justify-between">
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-2.5 text-slate-400 hover:text-white disabled:opacity-40"
                    disabled={quantity <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-4 font-mono font-bold text-white">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                    className="p-2.5 text-slate-400 hover:text-white disabled:opacity-40"
                    disabled={quantity >= maxQuantity}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-[11px] text-slate-500">Max {maxQuantity} per shopper</span>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-400" /> Shipping address
              </label>
              {loadingAddresses ? (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading addresses…
                </div>
              ) : selectedAddress ? (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-start justify-between gap-3">
                  <div className="text-xs text-slate-300">
                    {selectedAddress.fullName && <p className="font-bold text-white">{selectedAddress.fullName}</p>}
                    <p>{describeAddress(selectedAddress)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddressModalOpen(true)}
                    className="text-[11px] font-bold text-nexus-400 hover:underline shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(true)}
                  className="w-full p-3 border border-dashed border-slate-700 rounded-xl text-xs font-bold text-nexus-400 hover:border-nexus-500 transition"
                >
                  + Add a shipping address
                </button>
              )}
            </div>

            {/* Payment */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-indigo-400" /> Payment method
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentMethod(method.id)}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold transition ${
                      paymentMethod === method.id
                        ? 'bg-nexus-600/20 border-nexus-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {method.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500">Sandbox payment. No real money is charged.</p>
            </div>

            {/* Summary */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Price when you join</span>
                <span className="font-mono text-white">
                  {formatMoney(unitPrice)} × {quantity}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Could drop to</span>
                <span className="font-mono text-emerald-400">{formatMoney(campaign.lowestPrice)} each</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2 font-bold text-white">
                <span>Paid now (tax &amp; shipping included)</span>
                <span className="font-mono text-base">{formatMoney(total)}</span>
              </div>
              <p className="flex items-start gap-1.5 text-[11px] text-slate-400 pt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                You always pay the final group price, never more than today. Any difference is refunded
                automatically, and if the group doesn't fill in time you get a full refund.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
          </div>

          <div className="p-5 border-t border-slate-800 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-bold hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || loadingAddresses}
              className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'start' ? `Start group & pay ${formatMoney(total)}` : `Join & pay ${formatMoney(total)}`}
            </button>
          </div>
        </div>
      </div>

      <AddressSelectorModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        selectedAddressId={selectedAddress?.id}
        onSelectAddress={(address) => {
          setSelectedAddress(address);
          setAddresses((list) => (list.some((a) => a.id === address.id) ? list : [...list, address]));
        }}
      />
    </>
  );
}
