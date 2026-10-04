import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2, Save, Search } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import { groupReverseApi } from '../api/groupReverseApi';
import { apiErrorMessage } from '../api/groupBuyApi';
import { formatMoney } from '../components/groupbuy/format';
import { useAuth } from '../context/AuthContext';

const inputClass =
  'w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:border-indigo-600 focus:outline-none';
const labelClass = 'block text-xs font-semibold text-slate-400 mb-1.5';

const emptyForm = {
  productId: '',
  description: '',
  requiredQuantity: '',
  targetPrice: '',
  maxPrice: '',
  minQuantityPerMember: 1,
  maxQuantityPerMember: '',
  joinDeadline: '',
  offerDeadline: '',
  deliveryCity: '',
};

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" in the browser's own timezone. */
const toLocalInput = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

const defaultJoinDeadline = () => {
  const date = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  return toLocalInput(date);
};

const defaultOfferDeadline = () => {
  const date = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  return toLocalInput(date);
};

/**
 * The customer who wants to start a group. Everything here is a promise to strangers: the quantity
 * you will personally take, the price you will not exceed, and how long you will wait for both.
 */
export default function GroupReverseCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    ...emptyForm,
    productId: searchParams.get('productId') ?? '',
    joinDeadline: defaultJoinDeadline(),
    offerDeadline: defaultOfferDeadline(),
  });
  const [errors, setErrors] = useState([]);
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [productsLoading, setProductsLoading] = useState(true);
  // Kept so that narrowing the search does not erase the product summary for a product already chosen.
  const [pickedProduct, setPickedProduct] = useState(null);

  const set = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const pickProduct = (productId) => {
    setForm((current) => ({ ...current, productId }));
    setPickedProduct(products.find((product) => product.id === productId) ?? null);
  };

  // The catalogue is paginated, so searching has to happen on the server. Filtering a single page
  // client-side would make every product outside that page impossible to find.
  useEffect(() => {
    const needle = productQuery.trim();
    const handle = setTimeout(() => {
      axiosClient
        .get('/products', {
          params: { size: 40, sortBy: 'newest', ...(needle ? { query: needle } : {}) },
        })
        .then((res) => {
          setProducts(res?.data?.content ?? []);
          setProductsLoading(false);
        })
        .catch(() => {
          setProducts([]);
          setProductsLoading(false);
        });
    }, needle ? 250 : 0);
    return () => clearTimeout(handle);
  }, [productQuery]);

  const selected = useMemo(
    () =>
      products.find((product) => product.id === form.productId) ??
      (pickedProduct?.id === form.productId ? pickedProduct : null),
    [products, form.productId, pickedProduct],
  );

  const filtered = products;

  const validate = () => {
    const found = [];
    if (!form.productId) found.push('Choose the product your group is after.');
    const required = Number(form.requiredQuantity);
    if (!Number.isInteger(required) || required < 1)
      found.push('Enter how many units the group needs in total.');
    const target = Number(form.targetPrice);
    const max = Number(form.maxPrice);
    if (!Number.isFinite(target) || target <= 0) found.push('Enter a target price above zero.');
    if (!Number.isFinite(max) || max <= 0) found.push('Enter a maximum price above zero.');
    if (Number.isFinite(target) && Number.isFinite(max) && max < target)
      found.push('The maximum price cannot be below the target price.');
    if (!form.joinDeadline) found.push('Choose when people must have joined by.');
    if (!form.offerDeadline) found.push('Choose when sellers must have bid by.');
    if (
      form.joinDeadline &&
      form.offerDeadline &&
      new Date(form.offerDeadline) <= new Date(form.joinDeadline)
    ) {
      found.push('The offer deadline has to be after the join deadline.');
    }
    const min = Number(form.minQuantityPerMember) || 1;
    const maxPerMember = Number(form.maxQuantityPerMember) || required;
    if (maxPerMember < min) found.push('The per-member maximum cannot be below the minimum.');
    if (Number.isFinite(required) && maxPerMember > required)
      found.push('The per-member maximum cannot exceed the total the group needs.');
    return found;
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (found.length) return;

    setSaving(true);
    setServerError('');
    try {
      const created = await groupReverseApi.createDemand({
        productId: form.productId,
        description: form.description.trim() || null,
        requiredQuantity: Number(form.requiredQuantity),
        targetPrice: Number(form.targetPrice),
        maxPrice: Number(form.maxPrice),
        minQuantityPerMember: Number(form.minQuantityPerMember) || 1,
        maxQuantityPerMember:
          Number(form.maxQuantityPerMember) || Number(form.requiredQuantity),
        // datetime-local yields a local wall-clock time with no zone. The field is a LocalDateTime,
        // so it must be sent as typed: converting with toISOString() would shift it by the UTC
        // offset and make a near-future deadline look like it had already passed.
        joinDeadline: `${form.joinDeadline}:00`,
        offerDeadline: `${form.offerDeadline}:00`,
        deliveryCity: form.deliveryCity.trim() || null,
      });
      navigate(`/group-reverse/${created.id}`);
    } catch (err) {
      setServerError(apiErrorMessage(err, 'Could not start the group demand.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Start a group demand
        </h1>
        <p className="text-sm text-slate-400">
          Signed in as {user?.email}. You will be the group's leader: you decide when the quantity
          is met, compare the seller bids, and choose who gets the contract. You are not charged for
          anybody else's share, and you can join as a member yourself.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-5">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          <h2 className="text-sm font-bold text-white">What is the group after?</h2>

          <div>
            <label className={labelClass} htmlFor="gr-product-search">
              Search products
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                id="gr-product-search"
                value={productQuery}
                onChange={(event) => setProductQuery(event.target.value)}
                placeholder="Start typing a product name or SKU"
                className={`${inputClass} pl-9`}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              {productsLoading
                ? 'Loading products…'
                : productQuery.trim()
                  ? `${filtered.length} match${filtered.length === 1 ? '' : 'es'} — keep typing to narrow it down.`
                  : 'Showing the 40 most recent. Search to reach any other product in the catalogue.'}
            </p>
          </div>

          <select
            value={form.productId}
            onChange={(event) => pickProduct(event.target.value)}
            className={inputClass}
            aria-label="Product"
          >
            <option value="">Select a product…</option>
            {form.productId && !filtered.some((product) => product.id === form.productId) && (
              <option value={form.productId}>{pickedProduct?.name ?? 'Selected product'}</option>
            )}
            {filtered.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} — {formatMoney(product.price)}
              </option>
            ))}
          </select>

          {selected && (
            <p className="text-xs text-slate-400">
              Listed at {formatMoney(selected.price)}.{' '}
              {selected.stockQuantity > 0
                ? `${selected.stockQuantity} in stock today.`
                : 'Currently out of stock — sellers may still be able to source it for the group.'}
            </p>
          )}

          <div>
            <label className={labelClass} htmlFor="gr-description">
              What is this group for? (optional)
            </label>
            <textarea
              id="gr-description"
              rows={3}
              value={form.description}
              onChange={set('description')}
              placeholder="Tell strangers why this matters and what a good price looks like."
              className={inputClass}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          <h2 className="text-sm font-bold text-white">Quantity and price</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass} htmlFor="gr-required">
                Total units the group needs
              </label>
              <input
                id="gr-required"
                type="number"
                min={1}
                value={form.requiredQuantity}
                onChange={set('requiredQuantity')}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="gr-target">
                Target price per unit
              </label>
              <input
                id="gr-target"
                type="number"
                min={0}
                step="0.01"
                value={form.targetPrice}
                onChange={set('targetPrice')}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="gr-max">
                Highest you will accept
              </label>
              <input
                id="gr-max"
                type="number"
                min={0}
                step="0.01"
                value={form.maxPrice}
                onChange={set('maxPrice')}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} htmlFor="gr-min">
                Smallest share one member may take
              </label>
              <input
                id="gr-min"
                type="number"
                min={1}
                value={form.minQuantityPerMember}
                onChange={set('minQuantityPerMember')}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="gr-max-per">
                Largest share one member may take
              </label>
              <input
                id="gr-max-per"
                type="number"
                min={1}
                value={form.maxQuantityPerMember}
                onChange={set('maxQuantityPerMember')}
                placeholder="Defaults to the total"
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            The maximum price is a hard limit: sellers bidding above it are turned away before the
            leader ever sees them.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          <h2 className="text-sm font-bold text-white">Deadlines and delivery</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} htmlFor="gr-join-deadline">
                People must have joined by
              </label>
              <input
                id="gr-join-deadline"
                type="datetime-local"
                value={form.joinDeadline}
                onChange={set('joinDeadline')}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="gr-offer-deadline">
                Sellers must have bid by
              </label>
              <input
                id="gr-offer-deadline"
                type="datetime-local"
                value={form.offerDeadline}
                onChange={set('offerDeadline')}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="gr-city">
              Delivery city (optional)
            </label>
            <input
              id="gr-city"
              value={form.deliveryCity}
              onChange={set('deliveryCity')}
              placeholder="Where the group wants the goods delivered"
              className={inputClass}
            />
          </div>
          <p className="text-[11px] text-slate-500">
            If the quantity is not met by the join deadline the group closes and everybody is
            released. Stock is only taken from a seller once you choose their bid.
          </p>
        </section>

        {errors.length > 0 && (
          <div className="rounded-xl border border-amber-800 bg-amber-950/50 p-3 space-y-1">
            {errors.map((message) => (
              <p key={message} className="flex items-start gap-2 text-xs text-amber-300">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {message}
              </p>
            ))}
          </div>
        )}

        {serverError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Creating…' : 'Create the demand'}
        </button>
      </form>
    </div>
  );
}
