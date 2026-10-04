export const OFFER_STATUS_META = {
  DRAFT: { label: 'Draft', className: 'bg-slate-900 border-slate-700 text-slate-300' },
  ACTIVE: { label: 'Live', className: 'bg-emerald-950/60 border-emerald-700 text-emerald-300' },
  PAUSED: { label: 'Paused', className: 'bg-orange-950/60 border-orange-800 text-orange-300' },
  CLOSED: { label: 'Closed', className: 'bg-slate-900 border-slate-700 text-slate-400' },
  CANCELLED: { label: 'Cancelled', className: 'bg-slate-900 border-slate-700 text-slate-400' },
};

export const POOL_STATUS_META = {
  OPEN: { label: 'Open', className: 'bg-emerald-950/60 border-emerald-700 text-emerald-300' },
  ALMOST_COMPLETE: { label: 'Almost complete', className: 'bg-amber-950/60 border-amber-700 text-amber-300' },
  COMPLETED: { label: 'Completed', className: 'bg-indigo-950/60 border-indigo-700 text-indigo-300' },
  PROCESSING: { label: 'Processing', className: 'bg-cyan-950/60 border-cyan-800 text-cyan-300' },
  FULFILLMENT: { label: 'Fulfillment', className: 'bg-cyan-950/60 border-cyan-800 text-cyan-300' },
  CLOSED: { label: 'Closed', className: 'bg-slate-900 border-slate-700 text-slate-400' },
  FAILED: { label: 'Failed', className: 'bg-rose-950/60 border-rose-800 text-rose-300' },
};

export const OFFER_FILTERS = [
  { id: 'all', label: 'All', statuses: null },
  { id: 'drafts', label: 'Drafts', statuses: ['DRAFT'] },
  { id: 'live', label: 'Live & paused', statuses: ['ACTIVE', 'PAUSED'] },
  { id: 'history', label: 'History', statuses: ['CLOSED', 'CANCELLED'] },
];

const OFFER_TERMINAL = ['CLOSED', 'CANCELLED'];

/**
 * True once the reservation window has passed. An expired offer can no longer be paused or
 * resumed, so the actions are hidden rather than offered as a dead end.
 */
export const isOfferDeadlinePassed = (offer) =>
  Boolean(offer?.reservationDeadline) && new Date(offer.reservationDeadline).getTime() <= Date.now();

export const isOfferTerminal = (status) => OFFER_TERMINAL.includes(status);
export const canEditOffer = (status) => status === 'DRAFT';
export const canActivateOffer = canEditOffer;
export const canPauseOffer = (offer) =>
  offer?.status === 'ACTIVE' && !isOfferDeadlinePassed(offer);
export const canResumeOffer = (offer) =>
  offer?.status === 'PAUSED' && !isOfferDeadlinePassed(offer);
export const canCancelOffer = (status) => !isOfferTerminal(status);

export const poolAcceptsReservations = (status) => status === 'OPEN' || status === 'ALMOST_COMPLETE';
