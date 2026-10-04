import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Crown,
  Loader2,
  LogOut,
  Package,
  Store,
  Truck,
  UserPlus,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { groupBuyApi, apiErrorMessage } from '../api/groupBuyApi';
import ActivityTimeline from '../components/groupbuy/ActivityTimeline';
import CelebrationOverlay from '../components/groupbuy/CelebrationOverlay';
import CountdownTimer from '../components/groupbuy/CountdownTimer';
import GroupBuyInvoice from '../components/groupbuy/GroupBuyInvoice';
import GroupProgress from '../components/groupbuy/GroupProgress';
import GroupStatusBadge from '../components/groupbuy/GroupStatusBadge';
import JoinGroupModal from '../components/groupbuy/JoinGroupModal';
import ParticipantList from '../components/groupbuy/ParticipantList';
import PriceLadder from '../components/groupbuy/PriceLadder';
import ReportProblemPanel from '../components/groupbuy/ReportProblemPanel';
import ShareGroupPanel from '../components/groupbuy/ShareGroupPanel';
import useLiveReload, { topics } from '../components/groupbuy/useLiveReload';
import { formatDateTime, formatMoney, formatPercent, PARTICIPANT_STATUS_LABEL } from '../components/groupbuy/format';

export default function GroupBuyGroupPage() {
  const { groupId } = useParams();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [banner, setBanner] = useState(
    location.state?.justJoined ? "You're in! Share your invite code to fill the group faster." : '',
  );
  const previousStatusRef = useRef(null);

  // Remember who invited this shopper, even across the login redirect
  const refKey = `gb_ref_${groupId}`;
  const [inviterId] = useState(() => {
    const fromUrl = searchParams.get('ref');
    try {
      if (fromUrl) {
        sessionStorage.setItem(refKey, fromUrl);
        return fromUrl;
      }
      return sessionStorage.getItem(refKey);
    } catch {
      return fromUrl;
    }
  });

  const loadGroup = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        setGroup(await groupBuyApi.getGroup(groupId));
        setError('');
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not load this group.'));
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [groupId],
  );

  useEffect(() => {
    loadGroup(true);
  }, [loadGroup]);

  useLiveReload([topics.GROUP_BUY], () => loadGroup(false), { enabled: !!group && !isJoinOpen });

  // Celebrate once when this shopper's group succeeds
  useEffect(() => {
    if (!group) return;
    const previous = previousStatusRef.current;
    previousStatusRef.current = group.status;
    if (group.status !== 'SUCCESS' || group.myMembership?.status !== 'CONVERTED') return;

    const key = `gb_celebrated_${group.id}`;
    let alreadyCelebrated = false;
    try {
      alreadyCelebrated = localStorage.getItem(key) === '1';
    } catch {
      alreadyCelebrated = false;
    }
    if ((previous && previous !== 'SUCCESS') || !alreadyCelebrated) {
      setShowCelebration(true);
      try {
        localStorage.setItem(key, '1');
      } catch {
        // storage unavailable; celebration may repeat
      }
    }
  }, [group]);

  const handleJoinClick = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location, message: 'Sign in to join this group.' } });
      return;
    }
    setActionError('');
    setIsJoinOpen(true);
  };

  const handleJoined = (updated) => {
    setIsJoinOpen(false);
    setGroup(updated);
    setBanner("You're in! Share your invite code to fill the group faster.");
    try {
      sessionStorage.removeItem(refKey);
    } catch {
      // ignore
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    setActionError('');
    try {
      setGroup(await groupBuyApi.leaveGroup(groupId));
      setConfirmLeave(false);
      setBanner('You left the group. Your payment has been fully refunded.');
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Could not leave the group.'));
    } finally {
      setLeaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 text-nexus-500 animate-spin" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl text-rose-300 text-sm">
          {error || 'Group not found'}
        </div>
        <Link to="/group-deals" className="inline-flex items-center gap-2 text-nexus-400 hover:underline text-xs font-semibold">
          <ArrowLeft className="w-4 h-4" /> Browse group deals
        </Link>
      </div>
    );
  }

  const campaign = group.campaign;
  const membership = group.myMembership;
  const isOpen = group.status === 'OPEN';
  const isActiveMember = membership?.status === 'JOINED';
  const isMemberForSharing = membership && ['JOINED', 'CONVERTED'].includes(membership.status);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Link
        to={`/group-deals/${campaign.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" /> Back to deal
      </Link>

      {banner && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-800 rounded-2xl text-xs text-emerald-200 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {banner}
          </span>
          <button type="button" onClick={() => setBanner('')} className="text-emerald-400 hover:text-white font-bold">
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <section className="glass-card p-5 sm:p-6 rounded-3xl border border-slate-800 space-y-5">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-32 h-32 rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0">
                {campaign.productImageUrl ? (
                  <img src={campaign.productImageUrl} alt={campaign.productName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <Package className="w-8 h-8" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <GroupStatusBadge status={group.status} />
                  <span className="text-[10px] text-slate-500 font-mono">Code {group.inviteCode}</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">{campaign.title}</h1>
                <p className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-amber-400" /> Led by {group.leaderName}
                    {group.viewerLeader && ' (you)'}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-indigo-400" /> {campaign.sellerStoreName}
                  </span>
                </p>
                <div className="flex flex-wrap items-baseline gap-3 pt-1">
                  <span className="text-3xl font-extrabold text-emerald-400 font-mono">{formatMoney(group.currentUnitPrice)}</span>
                  <span className="text-sm text-slate-500 line-through font-mono">{formatMoney(group.basePrice)}</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600/20 border border-emerald-700 text-emerald-300 text-[11px] font-bold">
                    {formatPercent(group.currentDiscountPercent)} off
                  </span>
                </div>
              </div>
            </div>

            {isOpen && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-end">
                  <GroupProgress {...group} />
                  <CountdownTimer expiresAt={group.expiresAt} label="Group closes in" onExpire={() => loadGroup(false)} />
                </div>

                {group.urgencyMessage && (
                  <div
                    className={`p-3 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
                      group.almostThere
                        ? 'bg-amber-950/50 border-amber-700 text-amber-200'
                        : 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                    }`}
                  >
                    <Zap className="w-4 h-4 shrink-0" /> {group.urgencyMessage}
                  </div>
                )}

                {group.nextTier && group.spotsToMinimum === 0 && (
                  <p className="text-[11px] text-slate-400">
                    Next tier: {formatMoney(group.nextTier.unitPrice)} each at {group.nextTier.minParticipants} shoppers.
                  </p>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-3">
                  {!membership || !isActiveMember ? (
                    <button
                      type="button"
                      onClick={handleJoinClick}
                      disabled={!group.joinable}
                      className="flex-1 min-w-[200px] py-3 rounded-2xl bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg transition disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" /> Join this group at {formatMoney(group.currentUnitPrice)}
                    </button>
                  ) : confirmLeave ? (
                    <div className="flex-1 p-3 bg-rose-950/40 border border-rose-800 rounded-2xl flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-rose-200">Leave the group? You'll get a full refund.</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmLeave(false)}
                          className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold"
                        >
                          Stay
                        </button>
                        <button
                          type="button"
                          onClick={handleLeave}
                          disabled={leaving}
                          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {leaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Leave group
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmLeave(true)}
                      className="px-4 py-2.5 rounded-2xl border border-slate-700 text-slate-300 hover:border-rose-700 hover:text-rose-300 text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <LogOut className="w-4 h-4" /> Leave group
                    </button>
                  )}
                </div>
                {!group.joinable && !isActiveMember && group.joinBlockedReason && (
                  <p className="text-[11px] text-slate-400">{group.joinBlockedReason}</p>
                )}
              </>
            )}

            {group.status === 'SUCCESS' && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-800 rounded-2xl space-y-1">
                <p className="text-sm font-bold text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Group succeeded with {group.participantCount} shoppers
                </p>
                <p className="text-xs text-emerald-100/80">
                  Final price {formatMoney(group.finalUnitPrice)} each · closed {formatDateTime(group.completedAt)}. Orders
                  were created automatically for every member.
                </p>
              </div>
            )}

            {(group.status === 'FAILED' || group.status === 'CANCELLED') && (
              <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-2xl space-y-1">
                <p className="text-sm font-bold text-rose-200 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-rose-400" />
                  {group.status === 'FAILED' ? "This group didn't reach its goal" : 'This group was cancelled'}
                </p>
                <p className="text-xs text-rose-100/80">
                  {group.failureReason}. Every payment was refunded in full.
                </p>
              </div>
            )}

            {actionError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {actionError}
              </div>
            )}
          </section>

          {/* Membership */}
          {membership && (
            <section className="glass-card p-5 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-400" /> Your participation
                </h2>
                <span className="text-[11px] font-bold text-slate-300">{PARTICIPANT_STATUS_LABEL[membership.status]}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                {[
                  ['Quantity', membership.quantity],
                  ['Paid at join', formatMoney(membership.amountPaid)],
                  ['Your price', membership.effectiveUnitPrice != null ? `${formatMoney(membership.effectiveUnitPrice)} ea` : '—'],
                  ['You save', formatMoney(membership.savings)],
                ].map(([label, value]) => (
                  <div key={label} className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
                    <p className="font-mono font-extrabold text-white">{value}</p>
                    <p className="text-[10px] text-slate-500 font-semibold">{label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400">
                <p>
                  Payment: <span className="text-slate-200 font-semibold">{membership.paymentStatus}</span> via{' '}
                  {membership.paymentMethod?.replace(/_/g, ' ')}
                </p>
                <p>
                  Refunded: <span className="text-slate-200 font-semibold">{formatMoney(membership.refundAmount)}</span>
                </p>
                <p className="sm:col-span-2">Ships to: {membership.shippingAddress}</p>
              </div>

              {membership.orderNumber && (
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/orders/confirmation/${membership.orderNumber}`}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Package className="w-3.5 h-3.5" /> Order {membership.orderNumber}
                  </Link>
                  <Link
                    to="/orders/tracking"
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Truck className="w-3.5 h-3.5" /> Track order ({membership.orderStatus})
                  </Link>
                </div>
              )}

              <div className="border-t border-slate-800 pt-4">
                <GroupBuyInvoice
                  group={group}
                  membership={membership}
                  customerName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
                  customerEmail={user?.email}
                />
              </div>

              <div className="border-t border-slate-800 pt-4">
                <ReportProblemPanel groupId={group.id} membershipStatus={membership.status} />
              </div>
            </section>
          )}

          <section className="glass-card p-5 rounded-3xl border border-slate-800">
            <ParticipantList participants={group.participants || []} myParticipantId={membership?.participantId} />
          </section>

          <section className="glass-card p-5 rounded-3xl border border-slate-800">
            <ActivityTimeline activities={group.activities || []} />
          </section>
        </div>

        <aside className="space-y-6">
          {isOpen && (
            <section className="glass-card p-5 rounded-3xl border border-slate-800">
              <ShareGroupPanel group={group} inviterUserId={isMemberForSharing ? membership.userId : null} />
            </section>
          )}
          <section className="glass-card p-5 rounded-3xl border border-slate-800">
            <PriceLadder
              basePrice={group.basePrice}
              tiers={group.priceLadder}
              participantCount={group.participantCount}
            />
          </section>
        </aside>
      </div>

      <JoinGroupModal
        isOpen={isJoinOpen}
        mode="join"
        campaign={campaign}
        group={group}
        invitedByUserId={inviterId}
        onClose={() => setIsJoinOpen(false)}
        onSuccess={handleJoined}
      />

      <CelebrationOverlay
        show={showCelebration}
        onClose={() => setShowCelebration(false)}
        savings={membership?.savings}
        orderNumber={membership?.orderNumber}
      />
    </div>
  );
}
