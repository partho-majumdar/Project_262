export const RGB_STATUS_META = {
  DRAFT: { label: 'Draft', className: 'bg-slate-900 border-slate-700 text-slate-300' },
  OPEN: { label: 'Collecting demand', className: 'bg-emerald-950/60 border-emerald-700 text-emerald-300' },
  ALMOST_COMPLETE: { label: 'Almost at target', className: 'bg-amber-950/60 border-amber-700 text-amber-300' },
  TARGET_REACHED: { label: 'Target reached', className: 'bg-indigo-950/60 border-indigo-700 text-indigo-300' },
  ACTIVATED: { label: 'Condition unlocked', className: 'bg-indigo-950/60 border-indigo-700 text-indigo-300' },
  PROCESSING: { label: 'Orders created', className: 'bg-cyan-950/60 border-cyan-800 text-cyan-300' },
  FULFILLMENT: { label: 'Fulfillment', className: 'bg-cyan-950/60 border-cyan-800 text-cyan-300' },
  COMPLETED: { label: 'Completed', className: 'bg-emerald-950/60 border-emerald-700 text-emerald-300' },
  CLOSED: { label: 'Closed early', className: 'bg-slate-900 border-slate-700 text-slate-400' },
  FAILED: { label: 'Target not met', className: 'bg-rose-950/60 border-rose-800 text-rose-300' },
  CANCELLED: { label: 'Cancelled', className: 'bg-slate-900 border-slate-700 text-slate-400' },
};

export const RGB_PARTICIPATION_META = {
  PARTICIPATING: { label: 'Counting toward the target', className: 'bg-emerald-950/60 border-emerald-700 text-emerald-300' },
  CONVERTED: { label: 'Order created', className: 'bg-indigo-950/60 border-indigo-700 text-indigo-300' },
  CANCELLED: { label: 'Withdrawn', className: 'bg-slate-900 border-slate-700 text-slate-400' },
  REFUNDED: { label: 'Refunded', className: 'bg-rose-950/60 border-rose-800 text-rose-300' },
};

export const RGB_OFFER_FILTERS = [
  { id: 'all', label: 'All', statuses: null },
  { id: 'drafts', label: 'Drafts', statuses: ['DRAFT'] },
  { id: 'live', label: 'Collecting demand', statuses: ['OPEN', 'ALMOST_COMPLETE'] },
  { id: 'activated', label: 'Unlocked', statuses: ['TARGET_REACHED', 'ACTIVATED', 'PROCESSING', 'FULFILLMENT', 'COMPLETED'] },
  { id: 'ended', label: 'Ended unmet', statuses: ['CLOSED', 'FAILED', 'CANCELLED'] },
];

const RGB_TERMINAL = ['COMPLETED', 'CLOSED', 'FAILED', 'CANCELLED'];
const RGB_UNLOCKED = ['TARGET_REACHED', 'ACTIVATED', 'PROCESSING', 'FULFILLMENT', 'COMPLETED'];

export const isRgbTerminal = (status) => RGB_TERMINAL.includes(status);
export const canEditRgbOffer = (status) => status === 'DRAFT';
export const canActivateRgbOffer = (status) => status === 'DRAFT';
export const canCloseRgbOffer = (status) => !isRgbTerminal(status) && !RGB_UNLOCKED.includes(status);
export const canStartRgbFulfillment = (status) => status === 'PROCESSING';
export const canCompleteRgbOffer = (status) => status === 'FULFILLMENT';

/** Plain-language summary of the seller-defined target condition, for cards and detail pages. */
export const describeRgbTarget = (offer) => {
  if (!offer) return '';
  switch (offer.targetType) {
    case 'DISCOUNT_THRESHOLD':
      return `Reach ${offer.targetQuantity} units of demand to unlock ${Number(offer.targetValue)}% off`;
    case 'TARGET_PRICE':
      return `Reach ${offer.targetQuantity} units of demand to unlock a ${windowed(offer.unlockedUnitPrice)} price`;
    default:
      return `Reach ${offer.targetQuantity} units of demand to unlock ${windowed(offer.unlockedUnitPrice)} / unit`;
  }
};

const windowed = (value) => `৳${Number(value ?? 0).toFixed(0)}`;
