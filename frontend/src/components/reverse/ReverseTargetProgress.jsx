import React from 'react';

/**
 * Progress toward a Reverse Group Buying target condition - collective demand against the seller's
 * target. This is a demand target, not a CWP wholesale minimum.
 */
export default function ReverseTargetProgress({ currentDemand, targetQuantity, compact = false }) {
  const pct = targetQuantity > 0 ? Math.min(100, Math.round((currentDemand / targetQuantity) * 100)) : 0;
  const met = currentDemand >= targetQuantity;
  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-400 font-semibold">
          {currentDemand} / {targetQuantity} units of collective demand
        </span>
        <span className={`font-bold ${met ? 'text-emerald-400' : 'text-slate-300'}`}>{pct}%</span>
      </div>
      <div className={`w-full ${compact ? 'h-1.5' : 'h-2'} bg-slate-800 rounded-full overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all ${met ? 'bg-emerald-500' : 'bg-cyan-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
