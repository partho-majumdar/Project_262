import { formatTaka } from '../../utils/currency';

export const formatMoney = formatTaka;

export const formatPercent = (value) => {
  const n = Number(value ?? 0);
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const timeAgo = (value) => {
  if (!value) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const PAYMENT_METHODS = [
  { id: 'CREDIT_CARD', label: 'Credit card' },
  { id: 'DEBIT_CARD', label: 'Debit card' },
  { id: 'PAYPAL', label: 'PayPal' },
  { id: 'STRIPE', label: 'Stripe' },
];

export const GROUP_STATUS_META = {
  OPEN: { label: 'Open', className: 'bg-nexus-950 border-nexus-600/60 text-nexus-300' },
  SUCCESS: { label: 'Successful', className: 'bg-emerald-950/60 border-emerald-700 text-emerald-300' },
  FAILED: { label: 'Failed', className: 'bg-rose-950/60 border-rose-800 text-rose-300' },
  CANCELLED: { label: 'Cancelled', className: 'bg-slate-900 border-slate-700 text-slate-400' },
};

export const PARTICIPANT_STATUS_LABEL = {
  JOINED: 'Active member',
  LEFT: 'Left the group',
  CONVERTED: 'Order created',
  REFUNDED: 'Refunded',
};

/** Mirrors the server tier rule for previews only; the server always recalculates the charged price. */
export const projectedUnitPrice = (basePrice, tiers = [], participantCount) => {
  let price = Number(basePrice ?? 0);
  (tiers || []).forEach((tier) => {
    if (participantCount >= tier.minParticipants && Number(tier.unitPrice) < price) {
      price = Number(tier.unitPrice);
    }
  });
  return price;
};
