import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8080/api/v1'
    : '/api/v1'
);

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor: Attach JWT Bearer token if present in localStorage
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('nexus_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Extract API response payload & handle global auth errors
axiosClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        // Token expired or invalid: Clear local session if needed
        localStorage.removeItem('nexus_token');
        localStorage.removeItem('nexus_user');
      }
      return Promise.reject(error.response.data || { message: 'An API error occurred' });
    } else if (error.request) {
      return Promise.reject({ message: 'Network error. Backend server could not be reached on http://localhost:8080.' });
    } else {
      return Promise.reject({ message: error.message || 'An unknown error occurred.' });
    }
  }
);

export default axiosClient;
