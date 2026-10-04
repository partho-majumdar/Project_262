import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Plus, Save, Send, Trash2 } from 'lucide-react';
import PriceLadder from '../../groupbuy/PriceLadder';
import { formatMoney, projectedUnitPrice } from '../../groupbuy/format';

const inputClass =
  'w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500';
const invalidInputClass = inputClass.replace('border-slate-800', 'border-rose-600');

/** `datetime-local` value ("YYYY-MM-DDTHH:mm") in the browser's local time. */
const toLocalInput = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

const defaultSchedule = () => {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { startAt: toLocalInput(start), endAt: toLocalInput(end) };
};

const round2 = (n) => Math.round(n * 100) / 100;

const formFromCampaign = (campaign) => {
  if (!campaign) {
    return {
      productId: '',
      title: '',
      description: '',
      minParticipants: 3,
      maxParticipants: 10,
      maxQuantityPerUser: 2,
      reservedQuantity: 30,
      groupDurationHours: 24,
      ...defaultSchedule(),
      tiers: [],
    };
  }
  return {
    productId: campaign.productId,
    title: campaign.title || '',
    description: campaign.description || '',
    minParticipants: campaign.minParticipants,
    maxParticipants: campaign.maxParticipants,
    maxQuantityPerUser: campaign.maxQuantityPerUser,
    reservedQuantity: campaign.reservedQuantity,
    groupDurationHours: campaign.groupDurationHours,
    startAt: String(campaign.startAt || '').slice(0, 16),
    endAt: String(campaign.endAt || '').slice(0, 16),
    tiers: (campaign.tiers || []).map((t) => ({ minParticipants: t.minParticipants, unitPrice: t.unitPrice })),
  };
};

/** Mirrors GroupBuyCampaignServiceImpl.validateRequest so sellers see problems before saving. */
const validate = (form, product) => {
  const errors = [];
  const n = (v) => Number(v);
  if (!form.productId) errors.push('Choose a product.');
  if (!form.title.trim()) errors.push('Title is required.');
  if (product && !product.active) errors.push('Only active products can be used for group buys.');
  if (n(form.minParticipants) < 2) errors.push('A group needs at least 2 participants.');
  if (n(form.maxParticipants) > 500) errors.push('Maximum participants must be at most 500.');
  if (n(form.maxParticipants) < n(form.minParticipants))
    errors.push('Maximum participants must be at least the minimum.');
  if (n(form.maxQuantityPerUser) < 1) errors.push('Max quantity per customer must be at least 1.');
  if (n(form.maxQuantityPerUser) > n(form.reservedQuantity))
    errors.push('Max quantity per customer cannot exceed the reserved quantity.');
  if (n(form.reservedQuantity) < n(form.minParticipants))
    errors.push('Reserve at least as many units as the minimum group size.');
  if (product && n(form.reservedQuantity) > n(product.stockQuantity))
    errors.push(`Only ${product.stockQuantity} unit(s) of this product are in stock.`);
  if (n(form.groupDurationHours) < 1 || n(form.groupDurationHours) > 720)
    errors.push('Group duration must be between 1 and 720 hours.');
  if (!form.startAt || !form.endAt) errors.push('Start and end times are required.');
  else {
    if (new Date(form.endAt) <= new Date(form.startAt)) errors.push('End time must be after the start time.');
    if (new Date(form.endAt) <= new Date()) errors.push('End time must be in the future.');
  }

  if (form.tiers.length === 0) errors.push('Add at least one price tier.');

  // Tier problems name the row the seller sees, so a long ladder is still easy to fix
  const tierErrors = form.tiers.map(() => []);
  const fail = (index, message) => {
    tierErrors[index].push(message);
    errors.push(`Tier ${index + 1}: ${message}`);
  };

  const firstAt = new Map();
  form.tiers.forEach((tier, index) => {
    const people = n(tier.minParticipants);
    if (!tier.unitPrice || n(tier.unitPrice) <= 0) fail(index, 'needs a price above zero.');
    if (!tier.minParticipants || people < 2) {
      fail(index, 'needs at least 2 people — a one-person tier is just a normal sale.');
    } else if (people > n(form.maxParticipants)) {
      fail(index, `unlocks at ${people} people, more than the maximum group size of ${form.maxParticipants}.`);
    } else if (firstAt.has(people)) {
      fail(index, `unlocks at ${people} people, the same as tier ${firstAt.get(people) + 1}.`);
    } else {
      firstAt.set(people, index);
    }
  });

  const sorted = form.tiers
    .map((tier, index) => ({ tier, index }))
    .filter(({ tier }) => n(tier.minParticipants) >= 2 && n(tier.unitPrice) > 0)
    .sort((a, b) => n(a.tier.minParticipants) - n(b.tier.minParticipants));
  let previous = product ? n(product.price) : Infinity;
  let previousLabel = product ? 'the product price' : null;
  sorted.forEach(({ tier, index }) => {
    if (n(tier.unitPrice) >= previous && previousLabel) {
      fail(index, `must be cheaper than ${previousLabel} (${formatMoney(previous)}).`);
    }
    previous = n(tier.unitPrice);
    previousLabel = `tier ${index + 1}`;
  });
  if (sorted.length > 0 && n(sorted[0].tier.minParticipants) > n(form.minParticipants)) {
    fail(sorted[0].index, `is the first tier, so it must unlock at ${form.minParticipants} people or fewer to match the minimum group size.`);
  }
  return { messages: [...new Set(errors)], tierErrors };
};

export default function CampaignForm({ campaign, products, saving, serverError, onSave, onCancel }) {
  const [form, setForm] = useState(() => formFromCampaign(campaign));
  const [attempted, setAttempted] = useState(false);
  const [previewSize, setPreviewSize] = useState(() => formFromCampaign(campaign).minParticipants);

  const product = useMemo(() => products.find((p) => p.id === form.productId) || null, [products, form.productId]);
  const basePrice = product ? Number(product.price) : campaign ? Number(campaign.basePrice) : 0;
  const { messages: errors, tierErrors } = useMemo(() => validate(form, product), [form, product]);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const selectProduct = (productId) => {
    const next = products.find((p) => p.id === productId);
    setForm((prev) => {
      const updated = { ...prev, productId };
      if (next) {
        if (!prev.title.trim()) updated.title = `Team up and save on ${next.name}`;
        updated.reservedQuantity = Math.min(Number(prev.reservedQuantity) || 1, next.stockQuantity || 0);
        if (prev.tiers.length === 0) {
          const price = Number(next.price);
          updated.tiers = [
            { minParticipants: Number(prev.minParticipants) || 2, unitPrice: round2(price * 0.9) },
            { minParticipants: Number(prev.maxParticipants) || 10, unitPrice: round2(price * 0.8) },
          ].filter((t, i, all) => i === 0 || t.minParticipants !== all[0].minParticipants);
        }
      }
      return updated;
    });
  };

  const updateTier = (index, field, value) =>
    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.map((tier, i) => (i === index ? { ...tier, [field]: value } : tier)),
    }));

  /** A tier below 2 people is never valid, so the box holds the floor instead of accepting 0 or 1. */
  const updateTierSize = (index, value) => {
    if (value === '') {
      updateTier(index, 'minParticipants', '');
      return;
    }
    const people = Math.floor(Number(value));
    updateTier(index, 'minParticipants', Number.isFinite(people) ? String(Math.max(2, people)) : '');
  };

  const addTier = () =>
    setForm((prev) => {
      const last = [...prev.tiers].sort((a, b) => a.minParticipants - b.minParticipants).pop();
      const minParticipants = last ? (Number(last.minParticipants) || 2) + 2 : Number(prev.minParticipants) || 2;
      const unitPrice = last ? round2(Number(last.unitPrice) * 0.95) : round2(basePrice * 0.9);
      return { ...prev, tiers: [...prev.tiers, { minParticipants, unitPrice }] };
    });

  const removeTier = (index) => setForm((prev) => ({ ...prev, tiers: prev.tiers.filter((_, i) => i !== index) }));

  const previewTiers = form.tiers
    .filter((t) => Number(t.minParticipants) >= 2 && Number(t.unitPrice) > 0)
    .map((t) => {
      const unitPrice = Number(t.unitPrice);
      const savings = Math.max(0, basePrice - unitPrice);
      return {
        minParticipants: Number(t.minParticipants),
        unitPrice,
        savingsPerUnit: savings,
        discountPercent: basePrice > 0 ? round2((savings / basePrice) * 100) : 0,
      };
    });

  const minSize = Math.max(2, Number(form.minParticipants) || 2);
  const maxSize = Math.max(minSize, Number(form.maxParticipants) || minSize);
  const clampedPreview = Math.min(maxSize, Math.max(minSize, Number(previewSize) || minSize));
  const previewPrice = projectedUnitPrice(basePrice, previewTiers, clampedPreview);
  const bestPrice = previewTiers.length ? Math.min(...previewTiers.map((t) => t.unitPrice)) : basePrice;
  const reserved = Number(form.reservedQuantity) || 0;

  const submit = (publishNow) => {
    setAttempted(true);
    if (errors.length > 0) return;
    onSave(
      {
        productId: form.productId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        minParticipants: Number(form.minParticipants),
        maxParticipants: Number(form.maxParticipants),
        maxQuantityPerUser: Number(form.maxQuantityPerUser),
        reservedQuantity: Number(form.reservedQuantity),
        groupDurationHours: Number(form.groupDurationHours),
        startAt: `${form.startAt}:00`,
        endAt: `${form.endAt}:00`,
        tiers: form.tiers.map((t) => ({ minParticipants: Number(t.minParticipants), unitPrice: Number(t.unitPrice) })),
      },
      publishNow
    );
  };

  const selectableProducts = products.filter((p) => p.active || p.id === form.productId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onCancel} className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 font-bold">
          <ArrowLeft className="w-4 h-4" /> Back to campaigns
        </button>
        <h2 className="text-lg font-black text-white">{campaign ? 'Edit group buy' : 'New group buy'}</h2>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 space-y-5">
          <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 text-xs">
            <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider">Deal</h3>
            <label className="block space-y-1">
              <span className="font-semibold text-slate-300">Product *</span>
              <select value={form.productId} onChange={(e) => selectProduct(e.target.value)} className={inputClass}>
                <option value="">Select a product…</option>
                {selectableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatMoney(p.price)} · {p.stockQuantity} in stock
                  </option>
                ))}
              </select>
              {selectableProducts.length === 0 && (
                <span className="block text-[11px] text-amber-300">
                  You have no active products yet. Add one in Product Catalog first.
                </span>
              )}
            </label>
            <label className="block space-y-1">
              <span className="font-semibold text-slate-300">Title *</span>
              <input type="text" maxLength={200} value={form.title} onChange={set('title')} className={inputClass} />
            </label>
            <label className="block space-y-1">
              <span className="font-semibold text-slate-300">Description</span>
              <textarea
                rows={3}
                maxLength={2000}
                value={form.description}
                onChange={set('description')}
                placeholder="What makes this deal worth sharing?"
                className={inputClass}
              />
            </label>
          </section>

          <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 text-xs">
            <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider">Group rules & inventory</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['minParticipants', 'Min group size', 2, 500],
                ['maxParticipants', 'Max group size', 2, 500],
                ['maxQuantityPerUser', 'Max units / customer', 1, undefined],
                ['reservedQuantity', 'Reserved units', 1, product?.stockQuantity],
              ].map(([field, label, min, max]) => (
                <label key={field} className="block space-y-1">
                  <span className="font-semibold text-slate-300">{label}</span>
                  <input type="number" min={min} max={max} value={form[field]} onChange={set(field)} className={inputClass} />
                </label>
              ))}
            </div>
            {product && (
              <p className="text-[11px] text-slate-400">
                Reserving <strong className="text-white">{reserved}</strong> of {product.stockQuantity} units. Reserved
                units leave regular stock when the campaign is published and unsold units return when it ends.
              </p>
            )}
          </section>

          <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 text-xs">
            <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider">Schedule</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block space-y-1">
                <span className="font-semibold text-slate-300">Campaign starts</span>
                <input type="datetime-local" value={form.startAt} onChange={set('startAt')} className={inputClass} />
              </label>
              <label className="block space-y-1">
                <span className="font-semibold text-slate-300">Campaign ends</span>
                <input type="datetime-local" value={form.endAt} onChange={set('endAt')} className={inputClass} />
              </label>
              <label className="block space-y-1">
                <span className="font-semibold text-slate-300">Each group lasts (hours)</span>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={form.groupDurationHours}
                  onChange={set('groupDurationHours')}
                  className={inputClass}
                />
              </label>
            </div>
            <p className="text-[11px] text-slate-400">
              After admin approval the campaign goes live at the start time (or immediately if that has passed). A group
              expires after its duration or at the campaign end, whichever comes first.
            </p>
          </section>

          <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider">Price tiers</h3>
              <button
                type="button"
                onClick={addTier}
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-indigo-500 text-indigo-300 rounded-lg font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add tier
              </button>
            </div>
            {form.tiers.length === 0 && (
              <p className="text-slate-500">Pick a product to get suggested tiers, or add your own.</p>
            )}
            {form.tiers.map((tier, index) => {
              const price = Number(tier.unitPrice);
              const pct = basePrice > 0 && price > 0 ? ((basePrice - price) / basePrice) * 100 : 0;
              const issues = tierErrors[index] || [];
              const invalid = attempted && issues.length > 0;
              return (
                <div key={index} className="space-y-1">
                  <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
                    <label className="block space-y-1">
                      <span className="text-slate-400">Tier {index + 1} · people needed</span>
                      <input
                        type="number"
                        min={2}
                        step={1}
                        value={tier.minParticipants}
                        onChange={(e) => updateTierSize(index, e.target.value)}
                        onBlur={(e) => updateTierSize(index, e.target.value === '' ? 2 : e.target.value)}
                        className={invalid ? invalidInputClass : inputClass}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-slate-400">Unit price (৳)</span>
                      <input
                        type="number"
                        min={0.01}
                        step="0.01"
                        value={tier.unitPrice}
                        onChange={(e) => updateTier(index, 'unitPrice', e.target.value)}
                        className={invalid ? invalidInputClass : inputClass}
                      />
                    </label>
                    <span className={`pb-2 font-bold w-16 text-right ${pct > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pct.toFixed(1)}% off
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTier(index)}
                      title="Remove tier"
                      className="p-2 mb-0.5 bg-slate-900 border border-slate-700 hover:border-rose-500 text-rose-400 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {invalid &&
                    issues.map((issue) => (
                      <p key={issue} className="text-[11px] text-rose-300">
                        This tier {issue}
                      </p>
                    ))}
                </div>
              );
            })}
          </section>
        </div>

        <aside className="xl:col-span-2 space-y-5">
          <section className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4 xl:sticky xl:top-4">
            <PriceLadder
              basePrice={basePrice}
              tiers={previewTiers}
              participantCount={clampedPreview}
              title="Live price ladder preview"
            />
            <label className="block space-y-1 text-xs">
              <span className="flex justify-between font-semibold text-slate-300">
                <span>Preview group of {clampedPreview}</span>
                <span className="font-mono text-white">{formatMoney(previewPrice)} / unit</span>
              </span>
              <input
                type="range"
                min={minSize}
                max={maxSize}
                value={clampedPreview}
                onChange={(e) => setPreviewSize(e.target.value)}
                className="w-full accent-indigo-500"
              />
            </label>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 block">Reserved at regular price</span>
                <span className="font-mono font-bold text-white">{formatMoney(reserved * basePrice)}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400 block">Sold out at best tier</span>
                <span className="font-mono font-bold text-emerald-300">{formatMoney(reserved * bestPrice)}</span>
              </div>
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

            <div className="flex flex-col sm:flex-row xl:flex-col gap-2">
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
                <Send className="w-4 h-4" /> Save &amp; publish
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
