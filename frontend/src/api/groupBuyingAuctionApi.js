import axiosClient from './axiosClient';

// axiosClient already unwraps the HTTP response, so `res` is the ApiResponse body.
const unwrap = (res) => res?.data;
const withReason = (reason) => (reason ? { reason } : {});

/**
 * Customer-facing Group Buying Auctions.
 * "Participate/bid collectively to influence the final purchasing price" - a different mechanism
 * from the wholesale pools in wholesaleApi.js and from the demand targets in reverseGroupBuyingApi.js.
 */
export const groupBuyingAuctionApi = {
  getAuctions: () => axiosClient.get('/group-buying-auctions').then(unwrap),
  getAuction: (auctionId) => axiosClient.get(`/group-buying-auctions/${auctionId}`).then(unwrap),
  getResult: (auctionId) => axiosClient.get(`/group-buying-auctions/${auctionId}/result`).then(unwrap),
  // A bid is the participation: `maxUnitPrice` is what makes it an auction rather than a pool.
  placeBid: (auctionId, payload) =>
    axiosClient.post(`/group-buying-auctions/${auctionId}/participate`, payload).then(unwrap),
  cancelParticipation: (id, reason) =>
    axiosClient.post(`/group-buying-auctions/participations/${id}/cancel`, withReason(reason)).then(unwrap),
  getMyParticipations: () => axiosClient.get('/group-buying-auctions/participations').then(unwrap),
};

/** Seller auction management. */
export const sellerAuctionApi = {
  getAuctions: () => axiosClient.get('/seller/group-buying-auctions').then(unwrap),
  getAuction: (id) => axiosClient.get(`/seller/group-buying-auctions/${id}`).then(unwrap),
  createAuction: (payload) => axiosClient.post('/seller/group-buying-auctions', payload).then(unwrap),
  updateAuction: (id, payload) => axiosClient.put(`/seller/group-buying-auctions/${id}`, payload).then(unwrap),
  publishAuction: (id) => axiosClient.post(`/seller/group-buying-auctions/${id}/publish`).then(unwrap),
  finalizeAuction: (id) => axiosClient.post(`/seller/group-buying-auctions/${id}/finalize`).then(unwrap),
  cancelAuction: (id, reason) =>
    axiosClient.post(`/seller/group-buying-auctions/${id}/cancel`, withReason(reason)).then(unwrap),
  getParticipations: (id) => axiosClient.get(`/seller/group-buying-auctions/${id}/participations`).then(unwrap),
  getResult: (id) => axiosClient.get(`/seller/group-buying-auctions/${id}/result`).then(unwrap),
};

/** Admin oversight. */
export const adminAuctionApi = {
  getAuctions: (status) =>
    axiosClient.get('/admin/group-buying-auctions', { params: status ? { status } : {} }).then(unwrap),
  getAuction: (id) => axiosClient.get(`/admin/group-buying-auctions/${id}`).then(unwrap),
  getResult: (id) => axiosClient.get(`/admin/group-buying-auctions/${id}/result`).then(unwrap),
  forceCancel: (id, reason) =>
    axiosClient.post(`/admin/group-buying-auctions/${id}/force-cancel`, withReason(reason)).then(unwrap),
};

export const AUCTION_PRICING_RULES = [
  {
    id: 'COLLECTIVE_QUANTITY_TIERS',
    label: 'Quantity tiers (ladder)',
    hint: 'Define rungs such as 1-4 units, 5-9 units, 10+ units. More collective units always means a cheaper unit price.',
  },
  {
    id: 'COLLECTIVE_QUANTITY_DISCOUNT',
    label: 'Percentage discount',
    hint: 'A single percentage off the starting price, applied once the minimum collective quantity is met.',
  },
];
