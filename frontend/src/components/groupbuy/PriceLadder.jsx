import React from 'react';
import { CheckCircle2, Lock, TrendingDown } from 'lucide-react';
import { formatMoney, formatPercent } from './format';

/**
 * Group buy price ladder. Pass `participantCount` to highlight the current and next tiers
 * for a specific group; omit it to show the campaign's tiers neutrally.
 */
export default function PriceLadder({ basePrice, tiers = [], participantCount = null, title = 'Group price ladder' }) {
  const sorted = [...(tiers || [])].sort((a, b) => a.minParticipants - b.minParticipants);
  const hasCount = participantCount !== null && participantCount !== undefined;

  let currentIndex = -1;
  if (hasCount) {
    sorted.forEach((tier, index) => {
      if (participantCount >= tier.minParticipants) currentIndex = index;
    });
  }
  const nextIndex = hasCount ? sorted.findIndex((tier) => tier.minParticipants > participantCount) : -1;
  const maxDiscount = Math.max(1, ...sorted.map((tier) => Number(tier.discountPercent || 0)));

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
        <TrendingDown className="w-4 h-4 text-emerald-400" /> {title}
      </h3>

      <div className="space-y-2">
        <div
          className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
            hasCount && currentIndex === -1 ? 'bg-slate-900 border-slate-600' : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <div>
            <p className="font-bold text-slate-300">Regular price</p>
            <p className="text-[10px] text-slate-500">Buying alone</p>
          </div>
          <span className="font-mono font-bold text-slate-400">{formatMoney(basePrice)}</span>
        </div>

        {sorted.map((tier, index) => {
          const isCurrent = hasCount && index === currentIndex;
          const isUnlocked = hasCount && index < currentIndex;
          const isNext = hasCount && index === nextIndex;
          const needed = hasCount ? tier.minParticipants - participantCount : 0;

          return (
            <div
              key={tier.minParticipants}
              className={`relative overflow-hidden p-3 rounded-2xl border text-xs transition ${
                isCurrent
                  ? 'bg-emerald-950/50 border-emerald-600 shadow-lg shadow-emerald-900/30'
                  : isNext
                    ? 'bg-amber-950/30 border-amber-700/70'
                    : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-emerald-500/10"
                style={{ width: `${(Number(tier.discountPercent || 0) / maxDiscount) * 100}%` }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    {isCurrent || isUnlocked ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      hasCount && <Lock className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    {tier.minParticipants}+ people
                  </p>
                  <p className="text-[10px] font-semibold">
                    {isCurrent && <span className="text-emerald-300">Current group price</span>}
                    {isUnlocked && <span className="text-emerald-400/80">Unlocked</span>}
                    {isNext && (
                      <span className="text-amber-300">
                        {needed} more {needed === 1 ? 'person' : 'people'} to unlock
                      </span>
                    )}
                    {!hasCount && <span className="text-slate-500">Save {formatMoney(tier.savingsPerUnit)} per unit</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-extrabold text-base text-white">{formatMoney(tier.unitPrice)}</p>
                  <p className="text-[10px] font-bold text-emerald-400">{formatPercent(tier.discountPercent)} off</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
