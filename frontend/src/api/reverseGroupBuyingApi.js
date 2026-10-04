import axiosClient from './axiosClient';

// axiosClient already unwraps the HTTP response, so `res` is the ApiResponse body.
const unwrap = (res) => res?.data;
const withReason = (reason) => (reason ? { reason } : {});

/**
 * Customer-facing Reverse Group Buying.
 * "Combine demand to unlock a target purchasing condition" - a different mechanism from the
 * wholesale pools in wholesaleApi.js, which pool quantity toward a wholesale minimum.
 */
export const reverseGroupBuyingApi = {
  getOffers: () => axiosClient.get('/reverse-group-buying/offers').then(unwrap),
  getOffer: (offerId) => axiosClient.get(`/reverse-group-buying/offers/${offerId}`).then(unwrap),
  getCampaign: (offerId) => axiosClient.get(`/reverse-group-buying/offers/${offerId}/campaign`).then(unwrap),
  participate: (offerId, payload) =>
    axiosClient.post(`/reverse-group-buying/offers/${offerId}/participate`, payload).then(unwrap),
  cancelParticipation: (id, reason) =>
    axiosClient.post(`/reverse-group-buying/participations/${id}/cancel`, withReason(reason)).then(unwrap),
  getMyParticipations: () => axiosClient.get('/reverse-group-buying/participations').then(unwrap),
};

/** Seller offer management. */
export const sellerReverseGroupBuyingApi = {
  getOffers: () => axiosClient.get('/seller/reverse-group-buying').then(unwrap),
  getOffer: (id) => axiosClient.get(`/seller/reverse-group-buying/${id}`).then(unwrap),
  createOffer: (payload) => axiosClient.post('/seller/reverse-group-buying', payload).then(unwrap),
  updateOffer: (id, payload) => axiosClient.put(`/seller/reverse-group-buying/${id}`, payload).then(unwrap),
  activateOffer: (id) => axiosClient.post(`/seller/reverse-group-buying/${id}/activate`).then(unwrap),
  closeOffer: (id, reason) =>
    axiosClient.post(`/seller/reverse-group-buying/${id}/close`, withReason(reason)).then(unwrap),
  startFulfillment: (id) => axiosClient.post(`/seller/reverse-group-buying/${id}/fulfillment`).then(unwrap),
  completeOffer: (id) => axiosClient.post(`/seller/reverse-group-buying/${id}/complete`).then(unwrap),
  getParticipations: (id) => axiosClient.get(`/seller/reverse-group-buying/${id}/participations`).then(unwrap),
  getCampaign: (id) => axiosClient.get(`/seller/reverse-group-buying/${id}/campaign`).then(unwrap),
};

/** Admin oversight. */
export const adminReverseGroupBuyingApi = {
  getOffers: (status) =>
    axiosClient.get('/admin/reverse-group-buying', { params: status ? { status } : {} }).then(unwrap),
  getOffer: (id) => axiosClient.get(`/admin/reverse-group-buying/${id}`).then(unwrap),
  forceCloseOffer: (id, reason) =>
    axiosClient.post(`/admin/reverse-group-buying/${id}/force-close`, withReason(reason)).then(unwrap),
};

export const REVERSE_TARGET_TYPES = [
  {
    id: 'TARGET_QUANTITY',
    label: 'Collective quantity target',
    hint: 'Unlocks an absolute unit price once customers collectively demand the target number of units.',
  },
  {
    id: 'TARGET_PRICE',
    label: 'Target price unlocked by demand',
    hint: 'The seller commits to a target price that only becomes payable once the demand target is met.',
  },
  {
    id: 'DISCOUNT_THRESHOLD',
    label: 'Discount threshold',
    hint: 'Unlocks a percentage off the regular price once the demand target is met. The unlocked price is derived for you.',
  },
];
