import axiosClient from './axiosClient';

// axiosClient already unwraps the HTTP response, so `res` is the ApiResponse body.
const unwrap = (res) => res?.data;
const withReason = (reason) => (reason ? { reason } : {});

/**
 * Group-Based Reverse Buying.
 *
 * The opposite direction from the seller-initiated Reverse Group Buying in
 * reverseGroupBuyingApi.js: there a seller publishes a discount and customers take it up, here a
 * customer publishes the quantity they need and sellers bid for the whole group. Nothing is shared
 * between the two beyond the shape of the API.
 */
export const groupReverseApi = {
  /** The public marketplace. Reachable without a login. */
  getDemands: () => axiosClient.get('/group-reverse-demands').then(unwrap),
  getDemand: (id) => axiosClient.get(`/group-reverse-demands/${id}`).then(unwrap),

  createDemand: (payload) => axiosClient.post('/group-reverse-demands', payload).then(unwrap),
  updateDemand: (id, payload) => axiosClient.put(`/group-reverse-demands/${id}`, payload).then(unwrap),
  publishDemand: (id) => axiosClient.post(`/group-reverse-demands/${id}/publish`).then(unwrap),
  cancelDemand: (id, reason) =>
    axiosClient.post(`/group-reverse-demands/${id}/cancel`, withReason(reason)).then(unwrap),

  joinDemand: (id, payload) => axiosClient.post(`/group-reverse-demands/${id}/join`, payload).then(unwrap),
  leaveDemand: (id, reason) =>
    axiosClient.post(`/group-reverse-demands/${id}/leave`, withReason(reason)).then(unwrap),

  /** Groups this customer created, and groups they joined under somebody else's leadership. */
  getMyLedDemands: () => axiosClient.get('/group-reverse-demands/my-led').then(unwrap),
  getMyJoinedDemands: () => axiosClient.get('/group-reverse-demands/my-joined').then(unwrap),
  getMyMembership: (id) => axiosClient.get(`/group-reverse-demands/${id}/my-membership`).then(unwrap),
  /** The roster. Leader only - the server refuses anybody else. */
  getMembers: (id) => axiosClient.get(`/group-reverse-demands/${id}/members`).then(unwrap),
  /** The competing bids. Leader only. */
  getOffers: (id) => axiosClient.get(`/group-reverse-demands/${id}/offers`).then(unwrap),
  selectOffer: (demandId, offerId) =>
    axiosClient.post(`/group-reverse-demands/${demandId}/offers/${offerId}/select`).then(unwrap),
};

/** Seller side: find a group that needs a quote, then bid for all of it. */
export const sellerGroupReverseApi = {
  /** Groups complete enough to bid on. */
  getAvailableDemands: () => axiosClient.get('/seller/group-reverse-demands/available').then(unwrap),
  getMyOffers: () => axiosClient.get('/seller/group-reverse-demands/my-offers').then(unwrap),
  submitOffer: (demandId, payload) =>
    axiosClient.post(`/seller/group-reverse-demands/${demandId}/offers`, payload).then(unwrap),
  reviseOffer: (offerId, payload) =>
    axiosClient.put(`/seller/group-reverse-demands/offers/${offerId}`, payload).then(unwrap),
  withdrawOffer: (offerId) =>
    axiosClient.post(`/seller/group-reverse-demands/offers/${offerId}/withdraw`).then(unwrap),
};

/** Admin oversight. */
export const adminGroupReverseApi = {
  getDemands: (status) =>
    axiosClient.get('/admin/group-reverse-demands', { params: status ? { status } : {} }).then(unwrap),
  getDemand: (id) => axiosClient.get(`/admin/group-reverse-demands/${id}`).then(unwrap),
  cancelDemand: (id, reason) =>
    axiosClient.post(`/admin/group-reverse-demands/${id}/cancel`, withReason(reason)).then(unwrap),
};

/**
 * Payment methods a member may commit with when joining a group. The server only accepts these
 * three, because a group order is paid online when the seller is chosen; cash on delivery and
 * debit cannot be honoured for a block that a single seller has already committed to fill.
 */
export const GROUP_REVERSE_PAYMENT_METHODS = [
  { id: 'CREDIT_CARD', label: 'Credit card' },
  { id: 'PAYPAL', label: 'PayPal' },
  { id: 'STRIPE', label: 'Stripe' },
];

/** Demand lifecycle, for badges and for the seller marketplace filter. */
export const GROUP_REVERSE_DEMAND_STATUS = {
  DRAFT: { id: 'DRAFT', label: 'Draft', tone: 'gray' },
  OPEN: { id: 'OPEN', label: 'Collecting members', tone: 'blue' },
  READY_FOR_OFFERS: { id: 'READY_FOR_OFFERS', label: 'Waiting for seller bids', tone: 'amber' },
  OFFERS_RECEIVED: { id: 'OFFERS_RECEIVED', label: 'Bids to compare', tone: 'purple' },
  OFFER_SELECTED: { id: 'OFFER_SELECTED', label: 'Seller chosen', tone: 'indigo' },
  ORDERS_CREATED: { id: 'ORDERS_CREATED', label: 'Orders created', tone: 'green' },
  COMPLETED: { id: 'COMPLETED', label: 'Completed', tone: 'green' },
  TARGET_NOT_REACHED: { id: 'TARGET_NOT_REACHED', label: 'Did not reach target', tone: 'gray' },
  NO_OFFER: { id: 'NO_OFFER', label: 'No seller bid', tone: 'gray' },
  EXPIRED: { id: 'EXPIRED', label: 'Expired undecided', tone: 'gray' },
  CANCELLED: { id: 'CANCELLED', label: 'Cancelled', tone: 'red' },
};

export const groupReverseStatusMeta = (status) =>
  GROUP_REVERSE_DEMAND_STATUS[status] ?? { id: status, label: status, tone: 'gray' };

/**
 * Turns an ISO timestamp into the coarse "2d 4h" form the badges use. Returns null rather than
 * "0m" for a missing value, so a caller can decide what an unknown deadline means.
 */
export const timeUntilLabel = (iso) => {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  const seconds = Math.floor((target - Date.now()) / 1000);
  if (seconds <= 0) return 'closed';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};
