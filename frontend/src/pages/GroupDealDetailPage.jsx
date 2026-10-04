import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  BellRing,
  CheckCircle2,
  Crown,
  Loader2,
  Package,
  RefreshCcw,
  ShieldCheck,
  Store,
  Ticket,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { groupBuyApi, apiErrorMessage } from '../api/groupBuyApi';
import PriceLadder from '../components/groupbuy/PriceLadder';
import CountdownTimer from '../components/groupbuy/CountdownTimer';
import GroupProgress from '../components/groupbuy/GroupProgress';
import JoinGroupModal from '../components/groupbuy/JoinGroupModal';
import useLiveReload, { topics } from '../components/groupbuy/useLiveReload';
import { formatDateTime, formatMoney, formatPercent } from '../components/groupbuy/format';
import { inviteRoute } from '../components/groupbuy/inviteCode';

const ENDED_STATUSES = ['SUCCESS', 'FAILED', 'CANCELLED'];

const CAMPAIGN_STATUS_TEXT = {
  SCHEDULED: 'This group buy starts soon.',
  PAUSED: 'The seller has temporarily paused this group buy.',
  SUCCESS: 'This group buy has ended.',
  FAILED: 'This group buy has ended.',
  CANCELLED: 'This group buy was cancelled.',
};

export default function GroupDealDetailPage() {
  const { campaignId } = useParams();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { mode: 'start' | 'join', group }
  const [selectedImage, setSelectedImage] = useState(0);
  const [inviteCode, setInviteCode] = useState('');
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState('');

  const loadDeal = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        setDeal(await groupBuyApi.getDeal(campaignId));
        setError('');
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not load this group deal.'));
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [campaignId],
  );

  useEffect(() => {
    loadDeal(true);
  }, [loadDeal]);

  useLiveReload([topics.GROUP_BUY], () => loadDeal(false), { enabled: !!deal && !modal });

  const openModal = (mode, group = null) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location, message: 'Sign in to join a group buy.' } });
      return;
    }
    setModal({ mode, group });
  };

  const toggleFollow = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location, message: 'Sign in to follow group deals.' } });
      return;
    }
    setFollowBusy(true);
    setFollowError('');
    try {
      const updated = deal.following
        ? await groupBuyApi.unfollowDeal(campaignId)
        : await groupBuyApi.followDeal(campaignId);
      setDeal(updated);
    } catch (err) {
      setFollowError(apiErrorMessage(err, 'Could not update this follow.'));
    } finally {
      setFollowBusy(false);
    }
  };

  const handleSuccess = (group) => {
    setModal(null);
    navigate(`/group-buy/groups/${group.id}`, { state: { justJoined: true } });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 text-nexus-500 animate-spin" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl text-rose-300 text-sm">
          {error || 'Group deal not found'}
        </div>
        <Link to="/group-deals" className="inline-flex items-center gap-2 text-nexus-400 hover:underline text-xs font-semibold">
          <ArrowLeft className="w-4 h-4" /> Back to group deals
        </Link>
      </div>
    );
  }

  const {
    campaign,
    openGroups = [],
    recentSuccessfulGroups = [],
    myActiveGroupId,
    canStartGroup,
    startGroupBlockedReason,
    following,
    followerCount = 0,
  } = deal;
  const canFollow = following || !ENDED_STATUSES.includes(campaign.status);
  const images = campaign.productImageUrls?.length ? campaign.productImageUrls : [campaign.productImageUrl].filter(Boolean);
  const statusText = CAMPAIGN_STATUS_TEXT[campaign.status];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <Link to="/group-deals" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white">
        <ArrowLeft className="w-4 h-4" /> All group deals
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Gallery */}
        <div className="lg:col-span-2 space-y-3">
          <div className="aspect-square rounded-3xl overflow-hidden bg-slate-900 border border-slate-800">
            {images.length > 0 ? (
              <img src={images[selectedImage] || images[0]} alt={campaign.productName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600">
                <Package className="w-12 h-12" />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setSelectedImage(index)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border shrink-0 ${
                    index === selectedImage ? 'border-nexus-500' : 'border-slate-800'
                  }`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="lg:col-span-3 space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-700 text-emerald-300 text-[11px] font-bold">
                <Users className="w-3.5 h-3.5" /> Group buy · up to {formatPercent(campaign.maxDiscountPercent)} off
              </span>
              {canFollow && (
                <button
                  type="button"
                  onClick={toggleFollow}
                  disabled={followBusy}
                  aria-pressed={!!following}
                  title={following ? 'Stop alerts for this deal' : 'Get alerts about new discounts and when this deal ends'}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold transition disabled:opacity-50 ${
                    following
                      ? 'bg-amber-950/50 border-amber-700 text-amber-200 hover:bg-amber-950'
                      : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-amber-600 hover:text-white'
                  }`}
                >
                  {following ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                  {following ? 'Following' : 'Follow deal'}
                  {followerCount > 0 && <span className="text-slate-400 font-semibold">· {followerCount}</span>}
                </button>
              )}
            </div>
            {followError && <p className="text-[11px] text-rose-300">{followError}</p>}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{campaign.title}</h1>
            <p className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
              <Link to={`/products/${campaign.productSlug}`} className="hover:text-white underline-offset-2 hover:underline">
                {campaign.productName}
              </Link>
              <span>·</span>
              <Link to={`/stores/${campaign.sellerStoreSlug}`} className="flex items-center gap-1 hover:text-white">
                <Store className="w-3.5 h-3.5 text-indigo-400" /> {campaign.sellerStoreName}
              </Link>
            </p>
          </div>

          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-500">Group price as low as</p>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-emerald-400 font-mono">{formatMoney(campaign.lowestPrice)}</span>
                <span className="text-sm text-slate-500 line-through font-mono">{formatMoney(campaign.basePrice)}</span>
              </div>
            </div>
            <CountdownTimer expiresAt={campaign.endAt} label="Deal ends in" onExpire={() => loadDeal(false)} />
          </div>

          {campaign.description && <p className="text-sm text-slate-300 leading-relaxed">{campaign.description}</p>}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            {[
              ['Shoppers joined', campaign.totalParticipants],
              ['Open groups', campaign.openGroupCount],
              ['Successful groups', campaign.successfulGroupCount],
              ['Units left', campaign.availableQuantity],
            ].map(([label, value]) => (
              <div key={label} className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
                <p className="font-mono text-lg font-extrabold text-white">{value}</p>
                <p className="text-[10px] text-slate-500 font-semibold">{label}</p>
              </div>
            ))}
          </div>

          {statusText && (
            <div className="p-3 bg-amber-950/40 border border-amber-800/70 rounded-2xl text-xs text-amber-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {statusText}
            </div>
          )}

          {myActiveGroupId ? (
            <Link
              to={`/group-buy/groups/${myActiveGroupId}`}
              className="flex items-center justify-between p-4 rounded-2xl bg-nexus-950/60 border border-nexus-600/60 hover:border-nexus-400 transition"
            >
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" /> You're in a group for this deal
              </span>
              <span className="text-xs font-bold text-nexus-300">View your group →</span>
            </Link>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => openModal('start')}
                disabled={!canStartGroup}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/40 transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Crown className="w-4 h-4" /> Start a new group &amp; be the leader
              </button>
              {!canStartGroup && startGroupBlockedReason && (
                <p className="text-[11px] text-slate-400 text-center">{startGroupBlockedReason}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-400">
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-2">
              <UserPlus className="w-4 h-4 text-nexus-400 shrink-0" /> Start or join a group and invite friends
            </div>
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-2">
              <RefreshCcw className="w-4 h-4 text-emerald-400 shrink-0" /> Price drops for everyone as the group grows
            </div>
            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" /> Full refund if the group doesn't fill in time
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Open groups */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold text-white">Open groups you can join</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const route = inviteRoute(inviteCode);
                if (route) navigate(route);
              }}
              className="flex items-center gap-2"
            >
              <label className="text-[11px] font-bold text-slate-400 whitespace-nowrap">Have an invite?</label>
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Paste the invite link or code"
                maxLength={200}
                className="w-56 bg-slate-950 border border-slate-800 focus:border-nexus-500 rounded-xl px-3 py-1.5 text-xs font-mono text-white placeholder:font-sans placeholder:text-slate-500"
              />
              <button
                type="submit"
                title="Open that group"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-100"
              >
                <Ticket className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {openGroups.length === 0 ? (
            <div className="glass-card p-8 rounded-3xl border border-slate-800 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-slate-300">No open groups yet</p>
              <p className="text-xs text-slate-500">Start the first group and share your invite code.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {openGroups.map((group) => (
                <div key={group.id} className="glass-card p-4 rounded-3xl border border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/60 flex items-center justify-center">
                        <Crown className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{group.leaderName}'s group</p>
                        <p className="text-[10px] text-slate-500 font-mono">Code {group.inviteCode}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-extrabold text-emerald-400">{formatMoney(group.currentUnitPrice)}</p>
                      <p className="text-[10px] text-slate-500">current price</p>
                    </div>
                  </div>

                  <GroupProgress {...group} compact />

                  {group.urgencyMessage && (
                    <p className={`text-[11px] font-semibold ${group.almostThere ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {group.urgencyMessage}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CountdownTimer expiresAt={group.expiresAt} variant="compact" onExpire={() => loadDeal(false)} />
                    <div className="flex gap-2">
                      <Link
                        to={`/group-buy/groups/${group.id}`}
                        className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => openModal('join', group)}
                        disabled={!group.joinable}
                        title={group.joinBlockedReason || ''}
                        className="px-4 py-1.5 rounded-xl bg-nexus-600 hover:bg-nexus-500 text-white text-xs font-bold transition disabled:opacity-40"
                      >
                        Join group
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {recentSuccessfulGroups.length > 0 && (
            <div className="space-y-2 pt-2">
              <h3 className="text-sm font-extrabold text-white">Recently successful groups</h3>
              {recentSuccessfulGroups.map((group) => (
                <div
                  key={group.id}
                  className="p-3 bg-emerald-950/30 border border-emerald-900 rounded-2xl flex items-center justify-between text-xs"
                >
                  <span className="text-slate-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    {group.participantCount} shoppers · {formatDateTime(group.completedAt)}
                  </span>
                  <span className="font-mono font-bold text-emerald-300">{formatMoney(group.finalUnitPrice)} each</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="glass-card p-5 rounded-3xl border border-slate-800 self-start space-y-4">
          <PriceLadder basePrice={campaign.basePrice} tiers={campaign.tiers} />
          <div className="text-[11px] text-slate-400 space-y-1 border-t border-slate-800 pt-3">
            <p>Groups need at least {campaign.minParticipants} and at most {campaign.maxParticipants} shoppers.</p>
            <p>Each group has {campaign.groupDurationHours} hour(s) to fill, until the deal ends.</p>
            <p>Buy up to {campaign.maxQuantityPerUser} unit(s) per shopper. Tax and shipping included.</p>
          </div>
        </aside>
      </div>

      <JoinGroupModal
        isOpen={!!modal}
        mode={modal?.mode}
        campaign={campaign}
        group={modal?.group}
        onClose={() => setModal(null)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
