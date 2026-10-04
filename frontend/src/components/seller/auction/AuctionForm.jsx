import React, { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Save, Trash2, Zap } from 'lucide-react';
import { formatMoney } from '../../groupbuy/format';
import { AUCTION_PRICING_RULES } from '../../../api/groupBuyingAuctionApi';

const inputClass =
  'w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500';

/** `datetime-local` value ("YYYY-MM-DDTHH:mm") in the browser's local time. */
const toLocalInput = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

const inHours = (hours) => {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + hours);
  return toLocalInput(d);
};

const formFromAuction = (auction) => {
  if (!auction) {
    return {
      productId: '',
      startingPrice: '',
      minimumSellerUnitPrice: '',
      availableQuantity: 100,
      minimumCollectiveQuantity: 50,
      minQuantityPerCustomer: 1,
      maxQuantityPerCustomer: 5,
      startsAt: inHours(1),
      endsAt: inHours(49),
      pricingRule: 'COLLECTIVE_QUANTITY_TIERS',
      discountPercent: '',
      tiers: [
        { minQuantity: 1, unitPrice: '' },
        { minQuantity: 10, unitPrice: '' },
        { minQuantity: 25, unitPrice: '' },
      ],
      description: '',
    };
  }
  const tiers = [...(auction.tiers ?? [])]
    .sort((a, b) => a.minQuantity - b.minQuantity)
    .map((t) => ({ minQuantity: t.minQuantity, unitPrice: String(t.unitPrice ?? '') }));
  return {
    productId: auction.productId,
    startingPrice: String(auction.startingPrice ?? ''),
    minimumSellerUnitPrice:
      auction.minimumSellerUnitPrice != null ? String(auction.minimumSellerUnitPrice) : '',
    availableQuantity: auction.availableQuantity,
    minimumCollectiveQuantity: auction.minimumCollectiveQuantity,
    minQuantityPerCustomer: auction.minQuantityPerCustomer,
    maxQuantityPerCustomer: auction.maxQuantityPerCustomer,
    startsAt: String(auction.startsAt || '').slice(0, 16),
    endsAt: String(auction.endsAt || '').slice(0, 16),
    pricingRule: auction.pricingRule,
    discountPercent: auction.discountPercent != null ? String(auction.discountPercent) : '',
    tiers: tiers.length > 0 ? tiers : [{ minQuantity: 1, unitPrice: '' }],
    description: auction.description || '',
  };
};

const n = (v) => Number(v);

/** Mirrors the server validation, including the pricing rules owned by AuctionPricingService. */
const validate = (form, product) => {
  const errors = [];
  if (!form.productId) errors.push('Choose a product.');
  if (product && !product.active) errors.push('Only active products can be used for group buying auctions.');
  if (!n(form.startingPrice) || n(form.startingPrice) <= 0) errors.push('The starting price must be greater than zero.');
  if (form.minimumSellerUnitPrice) {
    if (n(form.minimumSellerUnitPrice) <= 0) errors.push('The minimum seller unit price must be greater than zero.');
    else if (n(form.minimumSellerUnitPrice) >= n(form.startingPrice))
      errors.push('The minimum seller unit price must be lower than the starting price.');
  }
  if (form.endsAt && form.startsAt && new Date(form.endsAt) <= new Date(form.startsAt))
    errors.push('The auction end time must be after its start time.');
  if (form.endsAt && new Date(form.endsAt) <= new Date()) errors.push('The auction end time must be in the future.');
  if (!form.endsAt) errors.push('The auction end time is required.');
  if (n(form.minimumCollectiveQuantity) > n(form.availableQuantity))
    errors.push('The minimum collective quantity cannot exceed the available quantity.');
  if (n(form.maxQuantityPerCustomer) < n(form.minQuantityPerCustomer))
    errors.push('Maximum quantity per customer must be at least the minimum.');
  if (n(form.maxQuantityPerCustomer) > n(form.availableQuantity))
    errors.push('The maximum per customer cannot exceed the available quantity.');
  if (product && n(form.availableQuantity) > n(product.stockQuantity))
    errors.push(`Only ${product.stockQuantity} unit(s) of this product are in stock.`);

  if (form.pricingRule === 'COLLECTIVE_QUANTITY_TIERS') {
    const tiers = form.tiers.filter((t) => t.minQuantity !== '' || t.unitPrice !== '');
    if (tiers.length === 0) errors.push('A quantity-tier auction needs at least one price tier.');
    let previousMin = 0;
    tiers.forEach((tier, index) => {
      const min = n(tier.minQuantity);
      const price = n(tier.unitPrice);
      if (min < 1) errors.push(`Tier ${index + 1}: minimum quantity must be at least 1.`);
      if (!price || price <= 0) errors.push(`Tier ${index + 1}: unit price must be greater than zero.`);
      if (min <= previousMin) errors.push(`Tier ${index + 1}: minimum quantity must be greater than the previous tier.`);
      if (price && n(form.startingPrice) && price >= n(form.startingPrice))
        errors.push(`Tier ${index + 1}: unit price must be lower than the starting price.`);
      previousMin = Math.max(previousMin, min);
    });
  } else {
    const percent = n(form.discountPercent);
    if (!percent || percent <= 0 || percent >= 100)
      errors.push('The discount percentage must be between 0 and 100.');
    else if (n(form.startingPrice) * (1 - percent / 100) <= 0)
      errors.push('That discount would reduce the price to zero.');
    if (form.minimumSellerUnitPrice && n(form.startingPrice) * (1 - percent / 100) < n(form.minimumSellerUnitPrice))
      errors.push('The discounted price would fall below your minimum seller unit price.');
  }
  return [...new Set(errors)];
};

export default function AuctionForm({ auction, products, saving, serverError, onSave, onCancel }) {
  const [form, setForm] = useState(() => formFromAuction(auction));
  const [attempted, setAttempted] = useState(false);

  const product = useMemo(() => products.find((p) => p.id === form.productId) || null, [products, form.productId]);
  const errors = useMemo(() => validate(form, product), [form, product]);
  const ruleMeta = AUCTION_PRICING_RULES.find((r) => r.id === form.pricingRule);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const setTier = (index, field) => (e) =>
    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.map((tier, i) => (i === index ? { ...tier, [field]: e.target.value } : tier)),
    }));

  const submit = (publishNow) => {
    setAttempted(true);
    if (errors.length > 0) return;
    const payload = {
      productId: form.productId,
      description: form.description || null,
      startingPrice: n(form.startingPrice),
      minimumSellerUnitPrice: form.minimumSellerUnitPrice ? n(form.minimumSellerUnitPrice) : null,
      availableQuantity: n(form.availableQuantity),
      minimumCollectiveQuantity: n(form.minimumCollectiveQuantity),
      minQuantityPerCustomer: n(form.minQuantityPerCustomer),
      maxQuantityPerCustomer: n(form.maxQuantityPerCustomer),
      startsAt: form.startsAt,
      endsAt: form.endsAt,
      pricingRule: form.pricingRule,
      discountPercent: form.pricingRule === 'COLLECTIVE_QUANTITY_DISCOUNT' ? n(form.discountPercent) : null,
      tiers:
        form.pricingRule === 'COLLECTIVE_QUANTITY_TIERS'
          ? form.tiers
              .filter((t) => t.minQuantity !== '' && t.unitPrice !== '')
              .map((t) => ({ minQuantity: n(t.minQuantity), unitPrice: n(t.unitPrice) }))
          : null,
    };
    onSave(payload, publishNow);
  };

  return (
    <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-white">
          {auction ? 'Edit group buying auction' : 'New group buying auction'}
        </h3>
        <button onClick={onCancel} className="text-xs text-slate-400 hover:text-white font-bold">
          Cancel
        </button>
      </div>

      <p className="p-3 bg-amber-950/30 border border-amber-800/60 rounded-2xl text-[11px] text-amber-200">
        Bidders state a quantity and the most they will pay per unit. You configure one collective price rule; the
        price is calculated from the total quantity bid when the auction closes, and bids above it are refunded.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block space-y-1 text-xs md:col-span-2">
          <span className="font-semibold text-slate-300">Product</span>
          <select className={inputClass} value={form.productId} onChange={set('productId')} disabled={!!auction}>
            <option value="">Select a product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {formatMoney(p.price)} · {p.stockQuantity} in stock
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-slate-300">Starting price</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            className={inputClass}
            value={form.startingPrice}
            onChange={set('startingPrice')}
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-slate-300">Minimum seller unit price (optional floor)</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            className={inputClass}
            value={form.minimumSellerUnitPrice}
            onChange={set('minimumSellerUnitPrice')}
          />
        </label>

        <label className="block space-y-1 text-xs md:col-span-2">
          <span className="font-semibold text-slate-300">Collective pricing rule</span>
          <select className={inputClass} value={form.pricingRule} onChange={set('pricingRule')}>
            {AUCTION_PRICING_RULES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          {ruleMeta && <span className="text-[10px] text-slate-500">{ruleMeta.hint}</span>}
        </label>

        {form.pricingRule === 'COLLECTIVE_QUANTITY_TIERS' ? (
          <div className="md:col-span-2 space-y-2">
            <span className="text-xs font-semibold text-slate-300">Price ladder</span>
            <div className="space-y-2">
              {form.tiers.map((tier, index) => (
                <div key={index} className="flex items-end gap-2">
                  <label className="flex-1 space-y-1 text-[11px]">
                    <span className="text-slate-500">From quantity</span>
                    <input
                      type="number"
                      min="1"
                      className={inputClass}
                      value={tier.minQuantity}
                      onChange={setTier(index, 'minQuantity')}
                    />
                  </label>
                  <label className="flex-1 space-y-1 text-[11px]">
                    <span className="text-slate-500">Unit price</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      className={inputClass}
                      value={tier.unitPrice}
                      onChange={setTier(index, 'unitPrice')}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, tiers: prev.tiers.filter((_, i) => i !== index) }))}
                    className="px-2.5 py-2 rounded-xl bg-slate-900 border border-rose-800 text-rose-300 hover:bg-rose-950"
                    aria-label="Remove tier"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  tiers: [...prev.tiers, { minQuantity: '', unitPrice: '' }],
                }))
              }
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 text-slate-300 rounded-xl text-[11px] font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add tier
            </button>
            <p className="text-[10px] text-slate-500">
              Tiers must be listed once each, in ascending order, each cheaper than the one before.
            </p>
          </div>
        ) : (
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-slate-300">Discount percentage</span>
            <input
              type="number"
              min="0.01"
              max="99.99"
              step="0.01"
              className={inputClass}
              value={form.discountPercent}
              onChange={set('discountPercent')}
            />
            <span className="text-[10px] text-slate-500">
              Applied once the minimum collective quantity is met.
            </span>
          </label>
        )}

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
          <span className="font-semibold text-slate-300">Minimum collective quantity</span>
          <input
            type="number"
            min="1"
            className={inputClass}
            value={form.minimumCollectiveQuantity}
            onChange={set('minimumCollectiveQuantity')}
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-slate-300">Minimum quantity per bidder</span>
          <input
            type="number"
            min="1"
            className={inputClass}
            value={form.minQuantityPerCustomer}
            onChange={set('minQuantityPerCustomer')}
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-slate-300">Maximum quantity per bidder</span>
          <input
            type="number"
            min="1"
            className={inputClass}
            value={form.maxQuantityPerCustomer}
            onChange={set('maxQuantityPerCustomer')}
          />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-slate-300">Starts at</span>
          <input type="datetime-local" className={inputClass} value={form.startsAt} onChange={set('startsAt')} />
        </label>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-slate-300">Ends at</span>
          <input type="datetime-local" className={inputClass} value={form.endsAt} onChange={set('endsAt')} />
        </label>

        <label className="block space-y-1 text-xs md:col-span-2">
          <span className="font-semibold text-slate-300">Customer-facing description (optional)</span>
          <textarea
            className={inputClass}
            rows={3}
            value={form.description}
            onChange={set('description')}
            placeholder="Explain what happens to bids above the final price."
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
          className="flex-1 py-2.5 bg-slate-900 border border-slate-700 hover:border-amber-500 disabled:opacity-50 text-slate-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save as draft'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => submit(true)}
          className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <Zap className="w-4 h-4" /> Save & publish now
        </button>
      </div>
    </div>
  );
}
