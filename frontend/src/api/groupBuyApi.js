import axiosClient from './axiosClient';

// axiosClient already unwraps the HTTP response, so `res` is the ApiResponse body.
const unwrap = (res) => res?.data;

export const groupBuyApi = {
  getDeals: (params = {}) => axiosClient.get('/group-buys/deals', { params }).then(unwrap),
  getDeal: (campaignId) => axiosClient.get(`/group-buys/deals/${campaignId}`).then(unwrap),
  getDealsForProduct: (productId) =>
    axiosClient.get(`/group-buys/products/${productId}/deals`).then(unwrap),
  getGroup: (groupId) => axiosClient.get(`/group-buys/groups/${groupId}`).then(unwrap),
  getGroupByCode: (code) =>
    axiosClient.get(`/group-buys/groups/code/${encodeURIComponent(code)}`).then(unwrap),
  startGroup: (campaignId, payload) =>
    axiosClient.post(`/group-buys/deals/${campaignId}/groups`, payload).then(unwrap),
  joinGroup: (groupId, payload) =>
    axiosClient.post(`/group-buys/groups/${groupId}/join`, payload).then(unwrap),
  leaveGroup: (groupId) => axiosClient.post(`/group-buys/groups/${groupId}/leave`).then(unwrap),
  getMyGroups: (filter = 'all') =>
    axiosClient.get('/group-buys/me/groups', { params: { filter } }).then(unwrap),
  getMyStats: () => axiosClient.get('/group-buys/me/stats').then(unwrap),
  followDeal: (campaignId) => axiosClient.post(`/group-buys/deals/${campaignId}/follow`).then(unwrap),
  unfollowDeal: (campaignId) => axiosClient.delete(`/group-buys/deals/${campaignId}/follow`).then(unwrap),
  getFollowedDeals: () => axiosClient.get('/group-buys/me/followed-deals').then(unwrap),
  openDispute: (groupId, payload) => axiosClient.post(`/group-buys/groups/${groupId}/disputes`, payload).then(unwrap),
  getMyDisputes: () => axiosClient.get('/group-buys/me/disputes').then(unwrap),
};

const withReason = (reason) => (reason ? { reason } : {});

export const adminGroupBuyApi = {
  getOverview: () => axiosClient.get('/admin/group-buys/overview').then(unwrap),
  getCampaigns: (status) => axiosClient.get('/admin/group-buys', { params: status ? { status } : {} }).then(unwrap),
  getCampaign: (id) => axiosClient.get(`/admin/group-buys/${id}`).then(unwrap),
  getCampaignGroups: (id) => axiosClient.get(`/admin/group-buys/${id}/groups`).then(unwrap),
  forceCloseCampaign: (id, reason) =>
    axiosClient.post(`/admin/group-buys/${id}/force-close`, withReason(reason)).then(unwrap),
  cancelCampaign: (id, reason) => axiosClient.post(`/admin/group-buys/${id}/cancel`, withReason(reason)).then(unwrap),

  getGroup: (groupId) => axiosClient.get(`/admin/group-buys/groups/${groupId}`).then(unwrap),
  cancelGroup: (groupId, reason) =>
    axiosClient.post(`/admin/group-buys/groups/${groupId}/cancel`, withReason(reason)).then(unwrap),
  removeMember: (groupId, userId, reason) =>
    axiosClient.post(`/admin/group-buys/groups/${groupId}/members/${userId}/remove`, withReason(reason)).then(unwrap),

  getParticipants: (params = {}) => axiosClient.get('/admin/group-buys/participants', { params }).then(unwrap),
  getOrders: (limit = 200) => axiosClient.get('/admin/group-buys/orders', { params: { limit } }).then(unwrap),
  getActivity: (limit = 100) => axiosClient.get('/admin/group-buys/activity', { params: { limit } }).then(unwrap),
  getInventoryLogs: () => axiosClient.get('/admin/group-buys/inventory-logs').then(unwrap),

  getFraudFlags: (days = 30, includeReviewed = false) =>
    axiosClient.get('/admin/group-buys/fraud-flags', { params: { days, includeReviewed } }).then(unwrap),
  reviewFlag: (payload, days = 30) =>
    axiosClient.post('/admin/group-buys/fraud-flags/review', payload, { params: { days } }).then(unwrap),

  getDisputes: (status) => axiosClient.get('/admin/group-buys/disputes', { params: status ? { status } : {} }).then(unwrap),
  reviewDispute: (id, note) =>
    axiosClient.post(`/admin/group-buys/disputes/${id}/review`, note ? { note } : {}).then(unwrap),
  resolveDispute: (id, payload) => axiosClient.post(`/admin/group-buys/disputes/${id}/resolve`, payload).then(unwrap),
  rejectDispute: (id, note) => axiosClient.post(`/admin/group-buys/disputes/${id}/reject`, { note }).then(unwrap),

  // Platform-wide analytics: KPIs, trends, discount bands, products, campaigns and seller ranking
  getReport: (days = 30) => axiosClient.get('/admin/group-buys/reports', { params: { days } }).then(unwrap),

  // Estimated delivery: a platform rule plus per-order overrides
  getDeliverySettings: () => axiosClient.get('/admin/group-buys/delivery-settings').then(unwrap),
  updateDeliverySettings: (payload) => axiosClient.put('/admin/group-buys/delivery-settings', payload).then(unwrap),
  getDeliveryOrders: (params = {}) => axiosClient.get('/admin/group-buys/delivery-orders', { params }).then(unwrap),
  updateEstimatedDelivery: (orderNumber, payload) =>
    axiosClient.put(`/admin/group-buys/orders/${orderNumber}/estimated-delivery`, payload).then(unwrap),
  // Moderation actions are written to the platform audit log with a GROUP_BUY_ action prefix
  getAuditLogs: (page = 0, size = 100) =>
    axiosClient.get('/admin/audit-logs/search', { params: { q: 'GROUP_BUY_', page, size } }).then(unwrap),
};

export const DISPUTE_TYPES = [
  { id: 'ITEM_NOT_RECEIVED', label: 'Item not received' },
  { id: 'ITEM_DAMAGED_OR_WRONG', label: 'Item damaged or not as described' },
  { id: 'WRONG_PRICE_CHARGED', label: 'Charged the wrong price' },
  { id: 'REFUND_NOT_RECEIVED', label: 'Refund not received' },
  { id: 'UNFAIR_GROUP_OUTCOME', label: 'Group closed unfairly' },
  { id: 'OTHER', label: 'Other problem' },
];

export const sellerGroupBuyApi = {
  getCampaigns: () => axiosClient.get('/seller/group-buys').then(unwrap),
  getCampaign: (id) => axiosClient.get(`/seller/group-buys/${id}`).then(unwrap),
  createCampaign: (payload) => axiosClient.post('/seller/group-buys', payload).then(unwrap),
  updateCampaign: (id, payload) => axiosClient.put(`/seller/group-buys/${id}`, payload).then(unwrap),
  publishCampaign: (id) => axiosClient.post(`/seller/group-buys/${id}/publish`).then(unwrap),
  pauseCampaign: (id) => axiosClient.post(`/seller/group-buys/${id}/pause`).then(unwrap),
  resumeCampaign: (id) => axiosClient.post(`/seller/group-buys/${id}/resume`).then(unwrap),
  cancelCampaign: (id, reason) =>
    axiosClient.post(`/seller/group-buys/${id}/cancel`, reason ? { reason } : {}).then(unwrap),
  getCampaignGroups: (id) => axiosClient.get(`/seller/group-buys/${id}/groups`).then(unwrap),
  getAnalytics: (days = 30) => axiosClient.get('/seller/group-buys/analytics', { params: { days } }).then(unwrap),
  // Private to the seller; `null` clears it
  updateUnitCost: (id, unitCost) => axiosClient.put(`/seller/group-buys/${id}/unit-cost`, { unitCost }).then(unwrap),
};

export const apiErrorMessage =(err, fallback = 'Something went wrong. Please try again.') => {
  if (err?.errors && typeof err.errors === 'object') {
    const first = Object.values(err.errors)[0];
    if (first) return String(first);
  }
  return err?.message || fallback;
};
