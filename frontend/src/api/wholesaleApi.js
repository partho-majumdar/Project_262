import axiosClient from './axiosClient';

// axiosClient already unwraps the HTTP response, so `res` is the ApiResponse body.
const unwrap = (res) => res?.data;
const withReason = (reason) => (reason ? { reason } : {});

/** Customer-facing marketplace, reservations and disputes. */
export const wholesaleApi = {
  getPools: () => axiosClient.get('/wholesale/pools').then(unwrap),
  getPool: (poolId) => axiosClient.get(`/wholesale/pools/${poolId}`).then(unwrap),
  reserve: (poolId, payload) => axiosClient.post(`/wholesale/pools/${poolId}/reserve`, payload).then(unwrap),
  getMyReservations: () => axiosClient.get('/wholesale/reservations').then(unwrap),
  cancelReservation: (id, reason) =>
    axiosClient.post(`/wholesale/reservations/${id}/cancel`, withReason(reason)).then(unwrap),
  openDispute: (reservationId, payload) =>
    axiosClient.post(`/wholesale/reservations/${reservationId}/disputes`, payload).then(unwrap),
  getMyDisputes: () => axiosClient.get('/wholesale/disputes').then(unwrap),
};

/** Seller offer management. */
export const sellerWholesaleApi = {
  getOffers: () => axiosClient.get('/seller/wholesale').then(unwrap),
  getOffer: (id) => axiosClient.get(`/seller/wholesale/${id}`).then(unwrap),
  createOffer: (payload) => axiosClient.post('/seller/wholesale', payload).then(unwrap),
  updateOffer: (id, payload) => axiosClient.put(`/seller/wholesale/${id}`, payload).then(unwrap),
  activateOffer: (id) => axiosClient.post(`/seller/wholesale/${id}/activate`).then(unwrap),
  pauseOffer: (id) => axiosClient.post(`/seller/wholesale/${id}/pause`).then(unwrap),
  resumeOffer: (id) => axiosClient.post(`/seller/wholesale/${id}/resume`).then(unwrap),
  cancelOffer: (id, reason) => axiosClient.post(`/seller/wholesale/${id}/cancel`, withReason(reason)).then(unwrap),
  getOfferPools: (id) => axiosClient.get(`/seller/wholesale/${id}/pools`).then(unwrap),
};

/** Admin moderation of offers and disputes (no approval step - sellers activate their own offers). */
export const adminWholesaleApi = {
  getOffers: (status) => axiosClient.get('/admin/wholesale', { params: status ? { status } : {} }).then(unwrap),
  getOffer: (id) => axiosClient.get(`/admin/wholesale/${id}`).then(unwrap),
  forceCloseOffer: (id, reason) =>
    axiosClient.post(`/admin/wholesale/${id}/force-close`, withReason(reason)).then(unwrap),
  cancelOffer: (id, reason) => axiosClient.post(`/admin/wholesale/${id}/cancel`, withReason(reason)).then(unwrap),

  getDisputes: (status) => axiosClient.get('/admin/wholesale/disputes', { params: status ? { status } : {} }).then(unwrap),
  getDispute: (id) => axiosClient.get(`/admin/wholesale/disputes/${id}`).then(unwrap),
  reviewDispute: (id, note) =>
    axiosClient.post(`/admin/wholesale/disputes/${id}/review`, withReason(note)).then(unwrap),
  resolveDispute: (id, payload) => axiosClient.post(`/admin/wholesale/disputes/${id}/resolve`, payload).then(unwrap),
  rejectDispute: (id, note) => axiosClient.post(`/admin/wholesale/disputes/${id}/reject`, { note }).then(unwrap),
};

export const WHOLESALE_DISPUTE_TYPES = [
  { id: 'WRONG_QUANTITY', label: 'Wrong quantity' },
  { id: 'WRONG_PRODUCT', label: 'Wrong product' },
  { id: 'DAMAGED_PRODUCT', label: 'Damaged product' },
  { id: 'MISSING_PRODUCT', label: 'Missing product' },
  { id: 'DELIVERY_ISSUE', label: 'Delivery issue' },
  { id: 'OTHER', label: 'Other problem' },
];
