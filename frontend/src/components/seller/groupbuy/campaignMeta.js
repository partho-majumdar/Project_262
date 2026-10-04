export const CAMPAIGN_STATUS_META = {
  DRAFT: { label: 'Draft', className: 'bg-slate-900 border-slate-700 text-slate-300' },
  SCHEDULED: { label: 'Scheduled', className: 'bg-cyan-950/60 border-cyan-800 text-cyan-300' },
  ACTIVE: { label: 'Live', className: 'bg-emerald-950/60 border-emerald-700 text-emerald-300' },
  PAUSED: { label: 'Paused', className: 'bg-orange-950/60 border-orange-800 text-orange-300' },
  SUCCESS: { label: 'Completed', className: 'bg-indigo-950/60 border-indigo-700 text-indigo-300' },
  FAILED: { label: 'Failed', className: 'bg-rose-950/60 border-rose-800 text-rose-300' },
  CANCELLED: { label: 'Cancelled', className: 'bg-slate-900 border-slate-700 text-slate-400' },
};

export const CAMPAIGN_FILTERS = [
  { id: 'all', label: 'All', statuses: null },
  { id: 'drafts', label: 'Drafts', statuses: ['DRAFT'] },
  { id: 'live', label: 'Live & scheduled', statuses: ['ACTIVE', 'PAUSED', 'SCHEDULED'] },
  { id: 'history', label: 'History', statuses: ['SUCCESS', 'FAILED', 'CANCELLED'] },
];

const TERMINAL = ['SUCCESS', 'FAILED', 'CANCELLED'];

export const isTerminal = (status) => TERMINAL.includes(status);
export const canEdit = (status) => status === 'DRAFT';
export const canPublish = canEdit;
export const canPause = (status) => status === 'ACTIVE';
export const canResume = (status) => status === 'PAUSED';
export const canCancel = (status) => !isTerminal(status);

/** Stock has only been moved out of the product once the campaign went live. */
export const holdsReservation = (status) => ['SCHEDULED', 'ACTIVE', 'PAUSED'].includes(status);

/** Returns `{ level: 'critical' | 'low', message }` or null. */
export const inventoryAlert = (campaign) => {
  const { status, reservedQuantity, availableQuantity, productStock, minParticipants } = campaign;
  if (status === 'DRAFT') {
    return reservedQuantity > productStock
      ? {
          level: 'critical',
          message: `Needs ${reservedQuantity} units but the product has only ${productStock} in stock; publishing will fail.`,
        }
      : null;
  }
  if (!holdsReservation(status)) return null;
  if (availableQuantity <= 0) return { level: 'critical', message: 'Reserved stock is sold out.' };
  if (availableQuantity < minParticipants) {
    return {
      level: 'critical',
      message: `Only ${availableQuantity} reserved unit(s) left, fewer than one minimum group.`,
    };
  }
  if (availableQuantity <= Math.ceil(reservedQuantity * 0.2)) {
    return { level: 'low', message: `Only ${availableQuantity} of ${reservedQuantity} reserved units left.` };
  }
  return null;
};
