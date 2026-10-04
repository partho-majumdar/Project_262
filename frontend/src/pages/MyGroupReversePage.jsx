import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Crown, Loader2, Package, Users } from 'lucide-react';
import { groupReverseApi } from '../api/groupReverseApi';
import { apiErrorMessage } from '../api/groupBuyApi';
import { formatMoney } from '../components/groupbuy/format';
import useLiveReload, { topics } from '../components/groupbuy/useLiveReload';
import GroupReverseProgress from '../components/groupr/GroupReverseProgress';
import { GroupReverseStatusBadge } from '../components/groupr/GroupReverseOfferCard';

/**
 * Everything this customer has going on, in one place: the groups they started (where they hold the
 * decision) and the groups they joined under somebody else (where they are just a participant).
 */
export default function MyGroupReversePage() {
  const [led, setLed] = useState([]);
  const [joined, setJoined] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [mine, theirs] = await Promise.all([
        groupReverseApi.getMyLedDemands(),
        groupReverseApi.getMyJoinedDemands(),
      ]);
      setLed(mine ?? []);
      setJoined(theirs ?? []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load your group demands.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The groups this customer leads or joined: a member joining, a seller being chosen, or the
  // deadline sweep closing a group all refresh both lists at once.
  useLiveReload([topics.GROUP_REVERSE, topics.ORDERS], load);

  const live = useMemo(
    () => (rows) => (rows ?? []).filter((demand) => !['COMPLETED', 'CANCELLED'].includes(demand.status)),
    [],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const renderCard = (demand, { leading }) => (
    <Link
      key={demand.id}
      to={`/group-reverse/${demand.id}`}
      className="block rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-indigo-600 p-4 space-y-3 transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
            {leading} {demand.leaderName}
          </p>
          <h3 className="text-sm font-bold text-white truncate">{demand.productName}</h3>
        </div>
        <GroupReverseStatusBadge status={demand.status} />
      </div>

      <GroupReverseProgress demand={demand} />

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-500">Target {formatMoney(demand.targetPrice)}</span>
        {demand.myMembership?.orderNumber && (
          <span className="text-emerald-400 font-semibold">
            Order {demand.myMembership.orderNumber}
          </span>
        )}
        {!demand.myMembership?.orderNumber && demand.myMembership && (
          <span className="text-slate-400">
            Your share: {demand.myMembership.requestedQuantity} unit(s)
          </span>
        )}
      </div>
    </Link>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          My group demands
        </h1>
        <p className="text-sm text-slate-400">
          Groups you lead, and groups you have joined. As the leader of a group you compare the
          seller bids and decide; as a member you only ever see and pay for your own share.
        </p>
      </header>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-white">
          <Crown className="w-4 h-4 text-amber-400" /> Groups you lead ({live(led).length})
        </h2>
        {live(led).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
            You have not started a group yet.{' '}
            <Link to="/group-reverse/new" className="text-indigo-400 hover:underline font-semibold">
              Start one
            </Link>
            .
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {live(led).map((demand) => (
              <div key={demand.id} className="space-y-1">
                {renderCard(demand, { leading: 'Led by you' })}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-white">
          <Users className="w-4 h-4 text-indigo-400" /> Groups you joined ({live(joined).length})
        </h2>
        {live(joined).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
            You have not joined anyone else's group.{' '}
            <Link to="/group-reverse" className="text-indigo-400 hover:underline font-semibold">
              Find one to join
            </Link>
            .
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {live(joined).map((demand) => (
              <div key={demand.id} className="space-y-1">
                {renderCard(demand, { leading: 'Led by' })}
              </div>
            ))}
          </div>
        )}
      </section>

      {(led.length > live(led).length || joined.length > live(joined).length) && (
        <p className="flex items-center gap-2 text-xs text-slate-600">
          <Package className="w-3.5 h-3.5" />
          Finished and cancelled groups are hidden. Your order history keeps the record of anything
          that became an order.
        </p>
      )}
    </div>
  );
}
