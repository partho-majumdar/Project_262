import React from 'react';

/** Progress toward the wholesale minimum, per CWP spec section 4.1 ("units reserved vs required"). */
export default function WholesalePoolProgress({ pooledQuantity, wholesaleMinimumQuantity, compact = false }) {
  const pct = wholesaleMinimumQuantity > 0 ? Math.min(100, Math.round((pooledQuantity / wholesaleMinimumQuantity) * 100)) : 0;
  const met = pooledQuantity >= wholesaleMinimumQuantity;
  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-400 font-semibold">
          {pooledQuantity} / {wholesaleMinimumQuantity} units pooled
        </span>
        <span className={`font-bold ${met ? 'text-emerald-400' : 'text-slate-300'}`}>{pct}%</span>
      </div>
      <div className={`w-full ${compact ? 'h-1.5' : 'h-2'} bg-slate-800 rounded-full overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all ${met ? 'bg-emerald-500' : 'bg-indigo-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
