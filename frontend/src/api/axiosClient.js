import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8080/api/v1'
    : '/api/v1'
);

const TOKEN_KEY = 'nexus_token';
const USER_KEY = 'nexus_user';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 15000,
});

axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        // Clear local session and notify the app so the auth context can react.
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'token_expired' } }));
        }
      }
      return Promise.reject(error.response.data || { message: 'An API error occurred' });
    } else if (error.request) {
      return Promise.reject({ message: `Network error. Backend server could not be reached at ${API_BASE_URL}.` });
    }
    return Promise.reject({ message: error.message || 'An unknown error occurred.' });
  }
);

export default axiosClient;
