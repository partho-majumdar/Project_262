import React, { useMemo, useState } from 'react';
import { AlertTriangle, Save, Zap } from 'lucide-react';
import { formatMoney } from '../../groupbuy/format';

const inputClass =
  'w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500';

/** `datetime-local` value ("YYYY-MM-DDTHH:mm") in the browser's local time. */
const toLocalInput = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

const defaultDeadline = () => {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setDate(d.getDate() + 7);
  return toLocalInput(d);
};

const formFromOffer = (offer) => {
  if (!offer) {
    return {
      productId: '',
      mode: 'MINIMUM_QUANTITY_BASED',
      wholesaleUnitPrice: '',
      wholesaleMinimumQuantity: 50,
      maxAvailableQuantity: 100,
      minQuantityPerCustomer: 1,
      maxQuantityPerCustomer: 10,
      reservationDeadline: defaultDeadline(),
      expectedFulfillmentNote: '',
      deliveryConditions: '',
      autoReopenNewLot: false,
    };
  }
  return {
    productId: offer.productId,
    mode: offer.mode,
    wholesaleUnitPrice: offer.wholesaleUnitPrice,
    wholesaleMinimumQuantity: offer.wholesaleMinimumQuantity,
    maxAvailableQuantity: offer.maxAvailableQuantity,
    minQuantityPerCustomer: offer.minQuantityPerCustomer,
    maxQuantityPerCustomer: offer.maxQuantityPerCustomer,
    reservationDeadline: String(offer.reservationDeadline || '').slice(0, 16),
    expectedFulfillmentNote: offer.expectedFulfillmentNote || '',
    deliveryConditions: offer.deliveryConditions || '',
    autoReopenNewLot: !!offer.autoReopenNewLot,
  };
};

/** Mirrors WholesaleOfferServiceImpl.validateRequest so sellers see problems before saving. */
const validate = (form, product) => {
  const errors = [];
  const n = (v) => Number(v);
  if (!form.productId) errors.push('Choose a product.');
  if (product && !product.active) errors.push('Only active products can be used for wholesale offers.');
  if (n(form.maxQuantityPerCustomer) < n(form.minQuantityPerCustomer))
    errors.push('Maximum quantity per customer must be at least the minimum.');
  if (n(form.maxQuantityPerCustomer) > n(form.wholesaleMinimumQuantity))
    errors.push('Maximum quantity per customer cannot exceed the wholesale minimum quantity.');
  if (n(form.wholesaleMinimumQuantity) > n(form.maxAvailableQuantity))
    errors.push('Wholesale minimum quantity cannot exceed the maximum available quantity.');
  if (!form.reservationDeadline) errors.push('Reservation deadline is required.');
  else if (new Date(form.reservationDeadline) <= new Date()) errors.push('Reservation deadline must be in the future.');
  if (!form.wholesaleUnitPrice || n(form.wholesaleUnitPrice) <= 0) errors.push('Wholesale unit price must be greater than zero.');
  if (product && n(form.wholesaleUnitPrice) >= n(product.price))
    errors.push(`Wholesale unit price must be lower than the regular product price (${formatMoney(product.price)}).`);
  if (product && n(form.maxAvailableQuantity) > n(product.stockQuantity))
    errors.push(`Only ${product.stockQuantity} unit(s) of this product are in stock.`);
  return [...new Set(errors)];
};

export default function WholesaleOfferForm({ offer, products, saving, serverError, onSave, onCancel }) {
  const [form, setForm] = useState(() => formFromOffer(offer));
  const [attempted, setAttempted] = useState(false);

  const product = useMemo(() => products.find((p) => p.id === form.productId) || null, [products, form.productId]);
  const errors = useMemo(() => validate(form, product), [form, product]);

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submit = (activateNow) => {
    setAttempted(true);
    if (errors.length > 0) return;
    const payload = {
      ...form,
      wholesaleUnitPrice: Number(form.wholesaleUnitPrice),
      wholesaleMinimumQuantity: Number(form.wholesaleMinimumQuantity),
      maxAvailableQuantity: Number(form.maxAvailableQuantity),
      minQuantityPerCustomer: Number(form.minQuantityPerCustomer),
      maxQuantityPerCustomer: Number(form.maxQuantityPerCustomer),
      reservationDeadline: form.reservationDeadline,
    };
    onSave(payload, activateNow);
  };

  return (
    <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-white">{offer ? 'Edit wholesale offer' : 'New wholesale offer'}</h3>
        <button onClick={onCancel} className="text-xs text-slate-400 hover:text-white font-bold">
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block space-y-1 text-xs md:col-span-2">
          <span className="font-semibold text-slate-300">Product</span>
          <select className={inputClass} value={form.productId} onChange={set('productId')} disabled={!!offer}>
            <option value="">Select a product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {formatMoney(p.price)} · {p.stockQuantity} in stock
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-slate-300">Offer mode</span>
          <select className={inputClass} value={form.mode} onChange={set('mode')}>
            <option value="MINIMUM_QUANTITY_BASED">Minimum-quantity based</option>
            <option value="FIXED_LOT_BASED">Fixed-lot based</option>
          </select>
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-slate-300">Wholesale unit price</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            className={inputClass}
            value={form.wholesaleUnitPrice}
            onChange={set('wholesaleUnitPrice')}
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-slate-300">Wholesale minimum quantity</span>
          <input
            type="number"
            min="1"
            className={inputClass}
            value={form.wholesaleMinimumQuantity}
            onChange={set('wholesaleMinimumQuantity')}
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-slate-300">Maximum available quantity</span>
          <input
            type="number"
            min="1"
            className={inputClass}
            value={form.maxAvailableQuantity}
            onChange={set('maxAvailableQuantity')}
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-slate-300">Minimum quantity per customer</span>
          <input
            type="number"
            min="1"
            className={inputClass}
            value={form.minQuantityPerCustomer}
            onChange={set('minQuantityPerCustomer')}
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-slate-300">Maximum quantity per customer</span>
          <input
            type="number"
            min="1"
            className={inputClass}
            value={form.maxQuantityPerCustomer}
            onChange={set('maxQuantityPerCustomer')}
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-slate-300">Reservation deadline</span>
          <input
            type="datetime-local"
            className={inputClass}
            value={form.reservationDeadline}
            onChange={set('reservationDeadline')}
          />
        </label>

        <label className="flex items-center gap-2 text-xs md:col-span-2 pt-1">
          <input type="checkbox" checked={form.autoReopenNewLot} onChange={set('autoReopenNewLot')} className="accent-indigo-500" />
          <span className="font-semibold text-slate-300">
            Automatically open a new lot when one completes, while there's remaining inventory
          </span>
        </label>

        <label className="block space-y-1 text-xs md:col-span-2">
          <span className="font-semibold text-slate-300">Expected fulfillment note (optional)</span>
          <input
            className={inputClass}
            value={form.expectedFulfillmentNote}
            onChange={set('expectedFulfillmentNote')}
            placeholder="e.g. Ships within 5 business days after the pool completes"
          />
        </label>

        <label className="block space-y-1 text-xs md:col-span-2">
          <span className="font-semibold text-slate-300">Delivery conditions (optional)</span>
          <textarea
            className={inputClass}
            rows={3}
            value={form.deliveryConditions}
            onChange={set('deliveryConditions')}
          />
        </label>
      </div>

      {(attempted || serverError) && (errors.length > 0 || serverError) && (
        <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-800 text-rose-200 text-xs space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Fix before saving
          </p>
          <ul className="list-disc pl-4 space-y-0.5">
            {serverError && <li>{serverError}</li>}
            {attempted && errors.map((err) => <li key={err}>{err}</li>)}
          </ul>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => submit(false)}
          className="flex-1 py-2.5 bg-slate-900 border border-slate-700 hover:border-indigo-500 disabled:opacity-50 text-slate-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save as draft'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => submit(true)}
          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <Zap className="w-4 h-4" /> Save & activate now
        </button>
      </div>
    </div>
  );
}
