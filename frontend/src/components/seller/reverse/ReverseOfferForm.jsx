import React, { useMemo, useState } from 'react';
import { AlertTriangle, Save, Zap } from 'lucide-react';
import { formatMoney } from '../../groupbuy/format';
import { REVERSE_TARGET_TYPES } from '../../../api/reverseGroupBuyingApi';

const inputClass =
  'w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500';

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
  d.setDate(d.getDate() + 10);
  return toLocalInput(d);
};

const formFromOffer = (offer) => {
  if (!offer) {
    return {
      productId: '',
      targetType: 'TARGET_QUANTITY',
      targetValue: '',
      targetQuantity: 50,
      unlockedUnitPrice: '',
      availableQuantity: 100,
      minQuantityPerCustomer: 1,
      maxQuantityPerCustomer: 5,
      participationDeadline: defaultDeadline(),
      description: '',
    };
  }
  return {
    productId: offer.productId,
    targetType: offer.targetType,
    targetValue: offer.targetValue ?? '',
    targetQuantity: offer.targetQuantity,
    unlockedUnitPrice: offer.unlockedUnitPrice ?? '',
    availableQuantity: offer.availableQuantity,
    minQuantityPerCustomer: offer.minQuantityPerCustomer,
    maxQuantityPerCustomer: offer.maxQuantityPerCustomer,
    participationDeadline: String(offer.participationDeadline || '').slice(0, 16),
    description: offer.description || '',
  };
};

const round2 = (value) => Math.round(Number(value) * 100) / 100;

/** Mirrors the server's validation so sellers see problems before the offer is saved. */
const validate = (form, product) => {
  const errors = [];
  const n = (v) => Number(v);
  if (!form.productId) errors.push('Choose a product.');
  if (product && !product.active) errors.push('Only active products can be used for reverse group buying offers.');
  if (!n(form.targetQuantity) || n(form.targetQuantity) < 1) errors.push('Target quantity must be at least 1.');
  if (!n(form.availableQuantity) || n(form.availableQuantity) < 1)
    errors.push('Available quantity must be at least 1.');
  if (n(form.maxQuantityPerCustomer) < n(form.minQuantityPerCustomer))
    errors.push('Maximum quantity per customer must be at least the minimum.');
  if (n(form.targetQuantity) > n(form.availableQuantity))
    errors.push('The target quantity cannot exceed the available quantity.');
  if (n(form.maxQuantityPerCustomer) > n(form.availableQuantity))
    errors.push('The maximum per customer cannot exceed the available quantity.');
  if (product && n(form.availableQuantity) > n(product.stockQuantity))
    errors.push(`Only ${product.stockQuantity} unit(s) of this product are in stock.`);
  if (!form.participationDeadline) errors.push('Participation deadline is required.');
  else if (new Date(form.participationDeadline) <= new Date())
    errors.push('Participation deadline must be in the future.');

  if (form.targetType === 'DISCOUNT_THRESHOLD') {
    const percent = n(form.targetValue);
    if (!percent || percent <= 0 || percent >= 100)
      errors.push('Discount percentage must be between 0 and 100.');
    else if (product && round2(product.price) * (1 - percent / 100) <= 0)
      errors.push('That discount would reduce the price to zero.');
  } else {
    if (form.targetValue) errors.push('Target value is only used with the DISCOUNT_THRESHOLD target type.');
    const price = n(form.unlockedUnitPrice);
    if (!price || price <= 0) errors.push('An unlocked unit price is required for this target type.');
    else if (product && price >= n(product.price))
      errors.push(`The unlocked unit price must be lower than the regular product price (${formatMoney(product.price)}).`);
  }
  return [...new Set(errors)];
};

export default function ReverseOfferForm({ offer, products, saving, serverError, onSave, onCancel }) {
  const [form, setForm] = useState(() => formFromOffer(offer));
  const [attempted, setAttempted] = useState(false);

  const product = useMemo(() => products.find((p) => p.id === form.productId) || null, [products, form.productId]);
  const errors = useMemo(() => validate(form, product), [form, product]);
  const targetTypeMeta = REVERSE_TARGET_TYPES.find((t) => t.id === form.targetType);
  const derivedPrice =
    form.targetType === 'DISCOUNT_THRESHOLD' && product
      ? round2(Number(product.price) * (1 - Number(form.targetValue || 0) / 100))
      : null;

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submit = (activateNow) => {
    setAttempted(true);
    if (errors.length > 0) return;
    const payload = {
      productId: form.productId,
      description: form.description || null,
      targetType: form.targetType,
      targetValue: form.targetType === 'DISCOUNT_THRESHOLD' ? Number(form.targetValue) : null,
      targetQuantity: Number(form.targetQuantity),
      unlockedUnitPrice:
        form.targetType === 'DISCOUNT_THRESHOLD' ? derivedPrice : Number(form.unlockedUnitPrice),
      availableQuantity: Number(form.availableQuantity),
      minQuantityPerCustomer: Number(form.minQuantityPerCustomer),
      maxQuantityPerCustomer: Number(form.maxQuantityPerCustomer),
      participationDeadline: form.participationDeadline,
    };
    onSave(payload, activateNow);
  };

  return (
    <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-white">
          {offer ? 'Edit reverse group buying offer' : 'New reverse group buying offer'}
        </h3>
        <button onClick={onCancel} className="text-xs text-slate-400 hover:text-white font-bold">
          Cancel
        </button>
      </div>

      <p className="p-3 bg-cyan-950/30 border border-cyan-800/60 rounded-2xl text-[11px] text-cyan-200">
        You commit to a purchasing condition. It only unlocks once customers collectively demand the target
        quantity, and every customer's units are refunded if it never does.
      </p>

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

        <label className="block space-y-1 text-xs md:col-span-2">
          <span className="font-semibold text-slate-300">Purchasing condition</span>
          <select className={inputClass} value={form.targetType} onChange={set('targetType')}>
            {REVERSE_TARGET_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          {targetTypeMeta && <span className="text-[10px] text-slate-500">{targetTypeMeta.hint}</span>}
        </label>

        {form.targetType === 'DISCOUNT_THRESHOLD' ? (
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-slate-300">Discount percentage</span>
            <input
              type="number"
              min="0.01"
              max="99.99"
              step="0.01"
              className={inputClass}
              value={form.targetValue}
              onChange={set('targetValue')}
            />
            {derivedPrice != null && Number.isFinite(derivedPrice) && (
              <span className="text-[10px] text-emerald-400">
                Unlocked price {formatMoney(derivedPrice)} / unit (derived from the product price)
              </span>
            )}
          </label>
        ) : (
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-slate-300">Unlocked unit price</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className={inputClass}
              value={form.unlockedUnitPrice}
              onChange={set('unlockedUnitPrice')}
            />
            {product && <span className="text-[10px] text-slate-500">Regular price {formatMoney(product.price)}</span>}
          </label>
        )}

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-slate-300">Target quantity of collective demand</span>
          <input type="number" min="1" className={inputClass} value={form.targetQuantity} onChange={set('targetQuantity')} />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-slate-300">Available quantity</span>
          <input
            type="number"
            min="1"
            className={inputClass}
            value={form.availableQuantity}
            onChange={set('availableQuantity')}
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
          <span className="font-semibold text-slate-300">Participation deadline</span>
          <input
            type="datetime-local"
            className={inputClass}
            value={form.participationDeadline}
            onChange={set('participationDeadline')}
          />
        </label>

        <label className="block space-y-1 text-xs md:col-span-2">
          <span className="font-semibold text-slate-300">Customer-facing description (optional)</span>
          <textarea
            className={inputClass}
            rows={3}
            value={form.description}
            onChange={set('description')}
            placeholder="Explain what happens once the condition unlocks."
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
          className="flex-1 py-2.5 bg-slate-900 border border-slate-700 hover:border-cyan-500 disabled:opacity-50 text-slate-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save as draft'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => submit(true)}
          className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <Zap className="w-4 h-4" /> Save & activate now
        </button>
      </div>
    </div>
  );
}
