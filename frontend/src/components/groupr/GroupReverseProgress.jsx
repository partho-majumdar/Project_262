import React from 'react';
import { Users } from 'lucide-react';

/**
 * How far a group has got toward the quantity it needs. The bar is deliberately the loudest thing
 * on the card: whether a demand is worth joining depends almost entirely on how close it is.
 */
export default function GroupReverseProgress({ demand, className = '' }) {
  const required = Number(demand?.requiredQuantity ?? 0);
  const committed = Number(demand?.committedQuantity ?? 0);
  const percent = required > 0 ? Math.min(100, Math.round((committed / required) * 100)) : 0;
  const complete = required > 0 && committed >= required;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-bold text-white">
          {committed} <span className="text-slate-500">/ {required} units</span>
        </span>
        <span className="inline-flex items-center gap-1 text-slate-400">
          <Users className="w-3.5 h-3.5" />
          {demand?.memberCount ?? 0} member{(demand?.memberCount ?? 0) === 1 ? '' : 's'}
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            complete ? 'bg-emerald-500' : 'bg-indigo-500'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-[11px] text-slate-500">
        {complete
          ? 'Target reached — sellers can bid for the whole group.'
          : `${Number(demand?.remainingQuantity ?? 0)} more unit(s) needed to open the bidding round.`}
      </p>
    </div>
  );
}
