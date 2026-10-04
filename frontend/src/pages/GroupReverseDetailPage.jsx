import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  LogIn,
  Package,
  Rocket,
  Send,
  Store,
  Users,
  XCircle,
} from 'lucide-react';
import { groupReverseApi, GROUP_REVERSE_PAYMENT_METHODS } from '../api/groupReverseApi';
import { apiErrorMessage } from '../api/groupBuyApi';
import { formatDateTime, formatMoney } from '../components/groupbuy/format';
import useLiveReload, { topics } from '../components/groupbuy/useLiveReload';
import GroupReverseProgress from '../components/groupr/GroupReverseProgress';
import GroupReverseOfferCard, {
  DeadlineLabel,
  GroupReverseStatusBadge,
} from '../components/groupr/GroupReverseOfferCard';
import AddressSelectorModal from '../components/common/AddressSelectorModal';
import { useAuth } from '../context/AuthContext';

const inputClass =
  'w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:border-indigo-600 focus:outline-none';

/**
 * One group demand, from the point of view of whoever is looking at it.
 *
 * The page deliberately changes shape with your role. The leader sees the roster and the competing
 * bids and gets the decision button; a member sees their own share and a progress bar and nothing
 * about the sellers they cannot choose; a visitor sees the pitch and a prompt to sign in.
 */
export default function GroupReverseDetailPage() {
  const { demandId } = useParams();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [demand, setDemand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  const [members, setMembers] = useState([]);
  const [offers, setOffers] = useState([]);
  const [selectingId, setSelectingId] = useState(null);
  const [busy, setBusy] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('CREDIT_CARD');
  const [address, setAddress] = useState(null);
  const [showAddressPicker, setShowAddressPicker] = useState(false);

  const load = useCallback(
    async (spinner = false) => {
      if (spinner) setLoading(true);
      try {
        setDemand(await groupReverseApi.getDemand(demandId));
        setError('');
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not load this group demand.'));
      } finally {
        if (spinner) setLoading(false);
      }
    },
    [demandId],
  );

  useEffect(() => {
    load(true);
  }, [load]);

  // This is the page that most needs it: a leader watching strangers join, members watching the
  // progress bar move, and everyone watching a seller bid land - all without touching the page.
  useLiveReload([topics.GROUP_REVERSE, topics.STOREFRONT], () => load(false));

  // The roster and the bid list are leader-only, and only worth fetching once the group exists.
  const isLeader = Boolean(demand?.leader);
  useEffect(() => {
    if (!isLeader || !demandId) return;
    groupReverseApi
      .getMembers(demandId)
      .then((rows) => setMembers(rows ?? []))
      .catch(() => setMembers([]));
    groupReverseApi
      .getOffers(demandId)
      .then((rows) => setOffers(rows ?? []))
      .catch(() => setOffers([]));
  }, [isLeader, demandId, demand?.status, demand?.offerCount]);

  const run = async (action, successMessage) => {
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      await action();
      if (successMessage) setNotice(successMessage);
      await load(false);
    } catch (err) {
      setActionError(apiErrorMessage(err, 'That did not work.'));
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!address) {
      setActionError('Choose where this order should be delivered.');
      return;
    }
    await run(
      () =>
        groupReverseApi.joinDemand(demandId, {
          quantity: Number(quantity),
          addressId: address.id,
          paymentMethod,
        }),
      'You have joined the group.',
    );
  };

  const handleSelect = async (offer) => {
    if (
      !window.confirm(
        `Choose ${offer.sellerStoreName} at ${formatMoney(offer.unitPrice)} per unit?\n\n` +
          'This locks the price for every member and creates a separate order for each of them.',
      )
    ) {
      return;
    }
    setSelectingId(offer.id);
    await run(() => groupReverseApi.selectOffer(demandId, offer.id), 'Seller chosen. Orders created.');
    setSelectingId(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!demand) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl text-rose-300 text-sm">
          {error || 'Group demand not found'}
        </div>
        <Link
          to="/group-reverse"
          className="inline-flex items-center gap-2 text-indigo-400 hover:underline text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> All group demands
        </Link>
      </div>
    );
  }

  const membership = demand.myMembership;
  const canJoin = demand.canJoin && !membership;
  const isClosed = ['CANCELLED', 'TARGET_NOT_REACHED', 'NO_OFFER', 'EXPIRED', 'COMPLETED'].includes(
    demand.status,
  );
  const ordersCreated = demand.status === 'ORDERS_CREATED' || demand.status === 'COMPLETED';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        to="/group-reverse"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" /> All group demands
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <header className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <GroupReverseStatusBadge status={demand.status} />
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  {demand.productName}
                </h1>
                <p className="text-xs text-slate-500">
                  Started by {demand.leaderName} · {formatMoney(demand.productPrice)} each in store
                </p>
              </div>
              <div className="aspect-square w-20 shrink-0 rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                {demand.productImageUrl ? (
                  <img
                    src={demand.productImageUrl}
                    alt={demand.productName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <Package className="w-6 h-6" />
                  </div>
                )}
              </div>
            </div>

            {demand.description && (
              <p className="text-sm text-slate-300 border-l-2 border-slate-700 pl-3">
                {demand.description}
              </p>
            )}

            <GroupReverseProgress demand={demand} />

            {demand.closeNote && (
              <p className="text-xs text-slate-400 bg-slate-900/70 border border-slate-800 rounded-xl p-3">
                {demand.closeNote}
              </p>
            )}
          </header>

          {/* The leader's private half: who is in the group, and what they are bidding. */}
          {isLeader && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                <Users className="w-4 h-4 text-indigo-400" /> The group ({members.length})
              </h2>
              {members.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Nobody has joined yet. Share the link so strangers can fill the rest.
                </p>
              ) : (
                <ul className="space-y-2">
                  {members.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/70 border border-slate-800 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {member.customerName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {member.shippingCity} · {member.statusLabel}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-indigo-300 shrink-0">
                        {member.requestedQuantity} unit(s)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {isLeader && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-white">
                  Seller bids ({offers.filter((offer) => offer.status === 'SUBMITTED').length})
                </h2>
                <DeadlineLabel
                  iso={demand.offerDeadline}
                  prefix="Offers close in"
                  className="text-slate-400"
                />
              </div>

              {offers.length === 0 ? (
                <p className="text-xs text-slate-500">
                  {demand.acceptingOffers
                    ? 'No seller has bid yet. Sellers can see your group as soon as the quantity is met.'
                    : 'Sellers can only bid once the group has reached its full quantity.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {offers.map((offer) => (
                    <GroupReverseOfferCard
                      key={offer.id}
                      offer={offer}
                      selecting={selectingId === offer.id}
                      disabled={busy || ordersCreated}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {!isLeader && demand.status === 'READY_FOR_OFFERS' && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 text-sm text-slate-400">
              The group is full and sellers are bidding. {demand.leaderName.split(' ')[0]} is
              comparing the offers and will let you know which seller was chosen.
            </div>
          )}
        </div>

        {/* The right rail: terms, and the one action available to this viewer. */}
        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
            <h2 className="text-sm font-bold text-white">The terms</h2>
            <dl className="space-y-2 text-xs">
              {[
                ['Units needed', demand.requiredQuantity],
                ['Target price', formatMoney(demand.targetPrice)],
                ['Highest acceptable', formatMoney(demand.maxPrice)],
                ['Per member', `${demand.minQuantityPerMember} – ${demand.maxQuantityPerMember}`],
                ['Delivery to', demand.deliveryCity ?? 'Anywhere'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-white font-semibold text-right">{value}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Joins close</dt>
                <dd className="text-slate-300 text-right">{formatDateTime(demand.joinDeadline)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Offers close</dt>
                <dd className="text-slate-300 text-right">{formatDateTime(demand.offerDeadline)}</dd>
              </div>
            </dl>
          </section>

          {demand.status === 'DRAFT' && isLeader && (
            <section className="rounded-2xl border border-indigo-800 bg-indigo-950/30 p-5 space-y-3">
              <h2 className="text-sm font-bold text-white">This is still a draft</h2>
              <p className="text-xs text-slate-400">
                Publish it to let strangers join. Nothing is committed until you do.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => groupReverseApi.publishDemand(demandId), 'Published.')}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold"
              >
                <Rocket className="w-4 h-4" /> Publish the demand
              </button>
            </section>
          )}

          {/* A member's own slice: what they took, what it costs, and where it ships. */}
          {membership && (
            <section className="rounded-2xl border border-indigo-800 bg-indigo-950/30 p-5 space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" /> Your share
              </h2>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Quantity</dt>
                  <dd className="text-white font-bold">{membership.requestedQuantity}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Status</dt>
                  <dd className="text-white font-semibold">{membership.statusLabel}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Paying with</dt>
                  <dd className="text-slate-300">
                    {GROUP_REVERSE_PAYMENT_METHODS.find(
                      (method) => method.id === membership.paymentMethod,
                    )?.label ?? membership.paymentMethod}
                  </dd>
                </div>
                {membership.orderNumber && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Your order</dt>
                    <dd className="text-emerald-300 font-bold">{membership.orderNumber}</dd>
                  </div>
                )}
              </dl>
              {membership.totalAmount != null && (
                <p className="text-xs text-slate-400 border-t border-indigo-800 pt-2">
                  Your share of the group total:{' '}
                  <span className="text-white font-bold">
                    {formatMoney(membership.totalAmount)}
                  </span>
                  . Each member is billed separately — you are not paying for anybody else.
                </p>
              )}
            </section>
          )}

          {ordersCreated && demand.lockedUnitPrice != null && (
            <section className="rounded-2xl border border-emerald-800 bg-emerald-950/30 p-5 space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                <Store className="w-4 h-4 text-emerald-400" /> The seller you chose
              </h2>
              <p className="text-xs text-slate-300">
                {demand.selectedSellerStoreName} at{' '}
                <span className="font-bold text-emerald-300">
                  {formatMoney(demand.lockedUnitPrice)}
                </span>{' '}
                per unit.
              </p>
              <p className="text-[11px] text-slate-400">
                That price is locked for every member and stock has been reserved. Track your own
                order in your order history.
              </p>
            </section>
          )}

          {canJoin && isAuthenticated && (
            <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 space-y-3">
              <h2 className="text-sm font-bold text-white">Join this group</h2>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5" htmlFor="gr-qty">
                  How many units?
                </label>
                <input
                  id="gr-qty"
                  type="number"
                  min={demand.minQuantityPerMember}
                  max={Math.min(demand.maxQuantityPerMember, demand.remainingQuantity)}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className={inputClass}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Between {demand.minQuantityPerMember} and{' '}
                  {Math.min(demand.maxQuantityPerMember, demand.remainingQuantity)} unit(s).{' '}
                  {demand.remainingQuantity} still needed.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5" htmlFor="gr-pay">
                  How would you pay?
                </label>
                <select
                  id="gr-pay"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className={inputClass}
                >
                  {GROUP_REVERSE_PAYMENT_METHODS.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-400 mb-1.5">Deliver to</span>
                {address ? (
                  <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-300">
                    {address.fullName} · {address.streetAddress}, {address.city}
                    <button
                      type="button"
                      onClick={() => setShowAddressPicker(true)}
                      className="block text-indigo-400 hover:underline mt-1 font-semibold"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddressPicker(true)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-800 text-xs font-bold text-indigo-300 hover:border-indigo-600"
                  >
                    Choose a delivery address
                  </button>
                )}
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleJoin}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Join the group
              </button>
            </section>
          )}

          {canJoin && !isAuthenticated && (
            <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 space-y-3 text-center">
              <p className="text-sm text-slate-300">Sign in to take part in this group.</p>
              <button
                type="button"
                onClick={() =>
                  navigate('/login', {
                    state: { from: { pathname: `/group-reverse/${demandId}` } },
                  })
                }
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold"
              >
                <LogIn className="w-4 h-4" /> Sign in to join
              </button>
            </section>
          )}

          {membership && demand.status === 'OPEN' && membership.status === 'JOINED' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!window.confirm('Leave this group? Your reserved units will be released.')) return;
                run(
                  () => groupReverseApi.leaveDemand(demandId, 'Changed my mind'),
                  'You have left the group.',
                );
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-rose-800 text-rose-300 hover:bg-rose-950/40 disabled:opacity-50 text-xs font-bold"
            >
              <XCircle className="w-4 h-4" /> Leave the group
            </button>
          )}

          {isLeader && demand.status === 'DRAFT' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!window.confirm('Cancel this demand? Nobody can join it afterwards.')) return;
                run(() => groupReverseApi.cancelDemand(demandId, 'Cancelled by the creator'),
                  'Demand cancelled.');
              }}
              className="w-full px-4 py-2 rounded-xl border border-rose-800 text-rose-300 hover:bg-rose-950/40 disabled:opacity-50 text-xs font-bold"
            >
              Cancel the demand
            </button>
          )}

          {actionError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {actionError}
            </div>
          )}
          {notice && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {notice}
            </div>
          )}
        </aside>
      </div>

      <AddressSelectorModal
        isOpen={showAddressPicker}
        onClose={() => setShowAddressPicker(false)}
        selectedAddressId={address?.id}
        onSelectAddress={(chosen) => {
          setAddress(chosen);
          setShowAddressPicker(false);
        }}
      />
    </div>
  );
}
