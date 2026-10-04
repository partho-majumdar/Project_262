import React from 'react';
import { Gavel } from 'lucide-react';
import { formatMoney } from '../groupbuy/format';

/**
 * The seller's configured collective price ladder, plus where the current collective quantity sits
 * on it. The server always recalculates and locks the real price at finalization, so the highlighted
 * rung here is a projection for the shopper only.
 */
export default function AuctionPriceLadder({ auction, compact = false }) {
  if (!auction) return null;

  if (auction.pricingRule === 'COLLECTIVE_QUANTITY_DISCOUNT') {
    const percent = Number(auction.discountPercent ?? 0);
    const projected =
      auction.finalUnitPrice ?? Number(auction.startingPrice ?? 0) * (1 - percent / 100);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400 font-semibold">
            {percent}% off the starting price once {auction.minimumCollectiveQuantity} units are bid
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-extrabold text-emerald-400">{formatMoney(projected)}</span>
          <span className="text-[10px] text-slate-500 line-through">{formatMoney(auction.startingPrice)}</span>
        </div>
        {auction.finalized && (
          <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">
            Final price, locked
          </p>
        )}
      </div>
    );
  }

  const tiers = [...(auction.tiers ?? [])].sort((a, b) => a.minQuantity - b.minQuantity);
  if (tiers.length === 0) {
    return <p className="text-[11px] text-slate-500">No price tiers configured.</p>;
  }

  const current = auction.collectiveQuantity ?? 0;
  const reachedIndex = tiers.reduce((acc, tier, index) => (current >= tier.minQuantity ? index : acc), 0);
  const nextTier = tiers.find((tier) => tier.minQuantity > current);

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {tiers.map((tier, index) => {
          const reached = current >= tier.minQuantity;
          const active = index === reachedIndex;
          const next = nextTier?.minQuantity === tier.minQuantity;
          const from = tier.minQuantity;
          const to = tiers[index + 1] ? tiers[index + 1].minQuantity - 1 : null;
          return (
            <li
              key={tier.minQuantity}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-[11px] ${
                active
                  ? 'border-emerald-600 bg-emerald-950/50 text-emerald-200'
                  : reached
                    ? 'border-slate-700 bg-slate-950/60 text-slate-300'
                    : 'border-slate-800 bg-slate-950/40 text-slate-500'
              }`}
            >
              <span className="flex items-center gap-1.5 font-semibold">
                {active && <Gavel className="w-3 h-3" />}
                {to ? `${from}–${to} units` : `${from}+ units`}
                {next && <span className="text-[9px] uppercase tracking-wider opacity-70">next</span>}
              </span>
              <span className="font-mono font-bold">{formatMoney(tier.unitPrice)}</span>
            </li>
          );
        })}
      </ul>
      {!compact && auction.finalized && (
        <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">
          Final price {formatMoney(auction.finalUnitPrice)}, locked
        </p>
      )}
    </div>
  );
}
