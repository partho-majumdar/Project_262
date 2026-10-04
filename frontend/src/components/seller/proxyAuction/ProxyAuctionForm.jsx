import React, { useMemo, useState } from 'react';
import { AlertTriangle, Save, X } from 'lucide-react';
import { formatMoney } from '../../groupbuy/format';

const inputClass =
  'w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:border-amber-500';

/** `datetime-local` value ("YYYY-MM-DDTHH:mm") in the browser's local time. */
const toLocalInput = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

const inHours = (hours) => {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + hours);
  return toLocalInput(d);
};

/** An `auction` may be null, which is how the tab asks for a new one. */
const formFromAuction = (auction) => ({
  productId: auction?.productId || '',
  description: auction?.description || '',
  startingPrice: auction?.startingPrice ?? '',
  minimumBidIncrement: auction?.minimumBidIncrement ?? '',
  reservePrice: auction?.reservePrice ?? '',
  quantity: auction?.quantity ?? 1,
  startsAt: auction?.startsAt ? toLocalInput(new Date(auction.startsAt)) : inHours(1),
  endsAt: auction?.endsAt ? toLocalInput(new Date(auction.endsAt)) : inHours(25),
});

/**
 * Create or edit a proxy auction.
 *
 * Two things are worth spelling out in the labels. The reserve is optional and never shown to
 * bidders, and the lot's units are taken out of sellable stock the moment the auction is created -
 * so the quantity is a real commitment, not a number that can be quietly raised later.
 */
export default function ProxyAuctionForm({ products, auction, onSubmit, onCancel, busy }) {
  const [form, setForm] = useState(() => formFromAuction(auction));
  const [attempted, setAttempted] = useState(false);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const selected = useMemo(
    () => products.find((p) => String(p.id) === String(form.productId)),
    [products, form.productId],
  );

  const problems = [];
  if (!form.productId) problems.push('Choose the product being auctioned.');
  if (!(Number(form.startingPrice) > 0)) problems.push('Starting price must be greater than zero.');
  if (!(Number(form.minimumBidIncrement) > 0)) problems.push('Minimum increment must be greater than zero.');
  if (!(Number(form.quantity) >= 1)) problems.push('Quantity must be at least 1.');
  if (form.reservePrice !== '' && !(Number(form.reservePrice) > 0)) {
    problems.push('Reserve price must be blank or greater than zero.');
  }
  if (!form.startsAt || !form.endsAt) problems.push('Set both a start and an end time.');
  else if (new Date(form.endsAt) <= new Date(form.startsAt)) {
    problems.push('The end time must come after the start time.');
  }

  const available = Number(selected?.stockQuantity ?? 0);
  if (selected && Number(form.quantity) > available) {
    problems.push(`Only ${available} unit(s) of this product are in stock right now.`);
  }

  const submit = (event) => {
    event.preventDefault();
    setAttempted(true);
    if (problems.length > 0) return;

    const payload = {
      productId: form.productId,
      description: form.description.trim() || null,
      startingPrice: Number(form.startingPrice),
      minimumBidIncrement: Number(form.minimumBidIncrement),
      reservePrice: form.reservePrice === '' ? null : Number(form.reservePrice),
      quantity: Number(form.quantity),
      startsAt: form.startsAt,
      endsAt: form.endsAt,
    };

    // An update must not blank out fields the seller never touched, so only what changed is sent.
    onSubmit(auction ? pickChanges(payload, auction) : payload);
  };

  const pickChanges = (payload, existing) => {
    const changed = {};
    Object.entries(payload).forEach(([key, value]) => {
      const current = existing[key];
      const same =
        (value == null && (current == null || current === '')) ||
        String(value ?? '') === String(current ?? '');
      if (!same) changed[key] = value;
    });
    return changed;
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="text-sm font-bold text-white">{auction ? 'Edit Auction' : 'New Auction'}</h3>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {attempted && problems.length > 0 && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-2xl text-rose-300 text-xs space-y-1">
          {problems.map((problem) => (
            <p key={problem}>{problem}</p>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <label className="font-semibold text-slate-300">Product *</label>
        <select value={form.productId} onChange={set('productId')} className={inputClass} required>
          <option value="">Select a product</option>
          {products.map((product) => (
            <option key={product.id} value={product.id} disabled={Number(product.stockQuantity) < 1}>
              {product.name} ({product.stockQuantity} in stock)
            </option>
          ))}
        </select>
        {selected && (
          <p className="text-[11px] text-slate-500">
            List price {formatMoney(selected.price)} &middot; {available} unit(s) available
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="font-semibold text-slate-300">Starting price *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={form.startingPrice}
            onChange={set('startingPrice')}
            className={inputClass}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="font-semibold text-slate-300">Minimum increment *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={form.minimumBidIncrement}
            onChange={set('minimumBidIncrement')}
            className={inputClass}
            required
          />
        </div>
      </div>
      <p className="text-[11px] text-slate-500 -mt-2">
        Each rival bid lifts the price by exactly one increment, never by more.
      </p>

      <div className="space-y-1">
        <label className="font-semibold text-slate-300">Reserve price (optional)</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={form.reservePrice}
          onChange={set('reservePrice')}
          placeholder="Leave blank for no reserve"
          className={inputClass}
        />
        <p className="text-[11px] text-slate-500">
          Only you ever see this figure. Bidders are told a reserve exists, never what it is, and the
          lot fails to sell if the winner's authorised bid does not reach it.
        </p>
      </div>

      <div className="space-y-1">
        <label className="font-semibold text-slate-300">Quantity in this lot *</label>
        <input
          type="number"
          min="1"
          value={form.quantity}
          onChange={set('quantity')}
          className={inputClass}
          required
        />
        <p className="text-[11px] text-slate-500">
          These units leave sellable stock now and return only if the auction closes without a sale.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="font-semibold text-slate-300">Starts *</label>
          <input type="datetime-local" value={form.startsAt} onChange={set('startsAt')} className={inputClass} required />
        </div>
        <div className="space-y-1">
          <label className="font-semibold text-slate-300">Ends *</label>
          <input type="datetime-local" value={form.endsAt} onChange={set('endsAt')} className={inputClass} required />
        </div>
      </div>

      <div className="space-y-1">
        <label className="font-semibold text-slate-300">Description</label>
        <textarea
          value={form.description}
          onChange={set('description')}
          rows={3}
          maxLength={2000}
          placeholder="Condition, provenance, anything a bidder should weigh up."
          className={inputClass}
        />
      </div>

      {attempted && problems.length > 0 && (
        <p className="text-[11px] text-amber-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Fix the points above before saving.
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded-xl font-semibold text-xs"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl font-semibold text-xs flex items-center gap-1.5"
        >
          <Save className="w-3.5 h-3.5" />
          {busy ? 'Saving...' : auction ? 'Save Changes' : 'Create Auction'}
        </button>
      </div>
    </form>
  );
}
