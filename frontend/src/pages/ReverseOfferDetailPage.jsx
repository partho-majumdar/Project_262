import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  ShieldCheck,
  Store,
  Target,
  Users,
  XCircle,
} from 'lucide-react';
import { reverseGroupBuyingApi } from '../api/reverseGroupBuyingApi';
import { apiErrorMessage } from '../api/groupBuyApi';
import { useAuth } from '../context/AuthContext';
import useLiveReload, { topics } from '../components/groupbuy/useLiveReload';
import CountdownTimer from '../components/groupbuy/CountdownTimer';
import ReverseTargetProgress from '../components/reverse/ReverseTargetProgress';
import ParticipateReverseModal from '../components/reverse/ParticipateReverseModal';
import { RgbStatusBadge } from '../components/reverse/RgbStatusBadge';
import { describeRgbTarget, isRgbTerminal } from '../components/reverse/reverseMeta';
import { formatDateTime, formatMoney } from '../components/groupbuy/format';

export default function ReverseOfferDetailPage() {
  const { offerId } = useParams();
  const { isAuthenticated } = useAuth();
  const [offer, setOffer] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [flash, setFlash] = useState('');

  const load = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        const data = await reverseGroupBuyingApi.getOffer(offerId);
        setOffer(data);
        setError('');
        if (data?.targetReached) {
          // A confirmed purchase only exists once the condition unlocked, so the campaign is optional.
          reverseGroupBuyingApi
            .getCampaign(offerId)
            .then(setCampaign)
            .catch(() => setCampaign(null));
        } else {
          setCampaign(null);
        }
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not load this offer.'));
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [offerId]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  useLiveReload([topics.REVERSE_GROUP_BUYING], () => load(false));

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error || 'Offer not found.'}
        </div>
        <Link
          to="/reverse-group-buying"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to offers
        </Link>
      </div>
    );
  }

  const unlocked = offer.targetReached;
  const ended = isRgbTerminal(offer.status) || !offer.acceptsDemand;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        to="/reverse-group-buying"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to offers
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-5">
          <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden">
            <div className="aspect-[16/9] bg-slate-900">
              {offer.productImageUrl ? (
                <img src={offer.productImageUrl} alt={offer.productName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600">
                  <Package className="w-12 h-12" />
                </div>
              )}
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-extrabold text-white">{offer.productName}</h1>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                    <Store className="w-3 h-3" /> {offer.sellerStoreName}
                  </p>
                </div>
                <RgbStatusBadge status={offer.status} />
              </div>

              {offer.description && <p className="text-xs text-slate-300 leading-relaxed">{offer.description}</p>}

              {offer.closeReasonLabel && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-400">
                  <span className="font-bold text-slate-300">{offer.closeReasonLabel}</span>
                  {offer.closeNote ? ` — ${offer.closeNote}` : ''}
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-5 rounded-3xl border border-slate-800 space-y-4">
            <h2 className="text-xs font-black uppercase text-cyan-400 tracking-wider">The purchasing condition</h2>
            <p className="text-sm font-bold text-white">{describeRgbTarget(offer)}</p>
            <ReverseTargetProgress currentDemand={offer.currentDemand} targetQuantity={offer.targetQuantity} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <Metric label="Collective demand" value={`${offer.currentDemand}`} />
              <Metric label="Target" value={`${offer.targetQuantity}`} />
              <Metric label="Still needed" value={`${Math.max(0, offer.remainingToTarget)}`} />
              <Metric label="Customers" value={`${offer.participantCount}`} />
            </div>
            <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
              <Users className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Quantities are never pooled into a shared order. Each customer keeps their own order once the
              condition unlocks.
            </p>
          </div>

          {campaign && (
            <div className="glass-card p-5 rounded-3xl border border-emerald-800/60 bg-emerald-950/20 space-y-3">
              <h2 className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Condition unlocked — purchase confirmed
              </h2>
              <p className="text-xs text-slate-300">
                {campaign.totalConfirmedQuantity} units were confirmed at{' '}
                <span className="font-mono font-bold text-white">{formatMoney(campaign.unlockedUnitPrice)}</span> per
                unit across {campaign.participantCount} customers.
              </p>
              <p className="text-[11px] text-slate-500">Activated {formatDateTime(campaign.activatedAt)}</p>
            </div>
          )}

          {!unlocked && (
            <div className="glass-card p-5 rounded-3xl border border-slate-800 space-y-3">
              <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider">How it works for you</h2>
              <ol className="space-y-2 text-[11px] text-slate-400 list-decimal list-inside space-y-2">
                <li>Commit the quantity you want at the unlocked price. Your units are reserved immediately.</li>
                <li>Withdraw any time before the deadline and you are refunded in full.</li>
                <li>
                  When collective demand reaches {offer.targetQuantity} units, your order is created automatically
                  at {formatMoney(offer.unlockedUnitPrice)} per unit.
                </li>
                <li>If the deadline passes first, every commitment is refunded and stock is released.</li>
              </ol>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4 sticky top-24">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                {unlocked ? 'Unlocked price' : 'Price once the condition is met'}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                  {formatMoney(offer.unlockedUnitPrice)}
                </span>
                <span className="text-xs text-slate-500 line-through">{formatMoney(offer.basePrice)}</span>
              </div>
            </div>

            <div className="space-y-2 text-[11px]">
              <Row label="Your limit per customer" value={`${offer.minQuantityPerCustomer}–${offer.maxQuantityPerCustomer} units`} />
              <Row label="Quantity available" value={`${offer.availableQuantity} units`} />
              <Row label="Condition type" value={offer.targetTypeLabel || offer.targetType} />
              {offer.targetType === 'DISCOUNT_THRESHOLD' && offer.targetValue != null && (
                <Row label="Discount unlocked" value={`${Number(offer.targetValue)}% off`} />
              )}
            </div>

            {offer.acceptsDemand ? (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Demand closes in
                </span>
                <CountdownTimer expiresAt={offer.participationDeadline} />
              </div>
            ) : (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-400">
                {ended ? 'This offer is no longer accepting demand.' : 'Demand is temporarily closed.'}
              </div>
            )}

            {isAuthenticated && offer.acceptsDemand ? (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white text-sm font-bold shadow-lg transition"
              >
                Add my demand
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-500" />
                {isAuthenticated
                  ? 'This offer is not accepting demand.'
                  : 'Sign in to commit demand to this offer.'}
              </div>
            )}

            {flash && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-[11px] text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> {flash}
              </div>
            )}
            {ended && !unlocked && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/70 rounded-xl text-[11px] text-rose-300 flex items-start gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                The condition was not met, so all commitments were refunded.
              </div>
            )}
            <p className="text-[10px] text-slate-500 flex items-start gap-1.5">
              <Target className="w-3 h-3 mt-0.5 shrink-0" />
              Demand deadline {formatDateTime(offer.participationDeadline)}
            </p>
          </div>
        </div>
      </div>

      <ParticipateReverseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        offer={offer}
        onSuccess={() => {
          setIsModalOpen(false);
          setFlash('Your demand is reserved and counting toward the target.');
          load(false);
        }}
      />
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
      <p className="text-lg font-black font-mono text-white">{value}</p>
      <p className="text-[10px] text-slate-500 font-semibold">{label}</p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-bold text-right">{value}</span>
    </div>
  );
}
