import axiosClient from './axiosClient';

// axiosClient already unwraps the HTTP response, so `res` is the ApiResponse body.
const unwrap = (res) => res?.data;

export const notificationApi = {
  list: (limit = 50) => axiosClient.get('/notifications', { params: { limit } }).then(unwrap),
  unreadCount: () => axiosClient.get('/notifications/unread-count').then(unwrap),
  markRead: (id) => axiosClient.put(`/notifications/${id}/read`).then(unwrap),
  markAllRead: () => axiosClient.put('/notifications/read-all').then(unwrap),
  markCategoryRead: (category) =>
    axiosClient.put(`/notifications/categories/${encodeURIComponent(category)}/read`).then(unwrap),
  getPreferences: () => axiosClient.get('/notifications/preferences').then(unwrap),
  // changes: { CATEGORY_KEY: boolean }
  updatePreferences: (changes) => axiosClient.put('/notifications/preferences', changes).then(unwrap),
};
