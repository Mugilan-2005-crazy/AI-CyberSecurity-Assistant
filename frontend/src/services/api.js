/**
 * services/api.js
 * ------------------------------------------------------------
 * Configured axios client. Automatically attaches the JWT
 * access token to every request, exposes a helper to update
 * the token, and unwraps { success, data } responses. Central
 * place to point at the backend (env-driven base URL).
 */
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

let accessToken = localStorage.getItem('accessToken') || '';

export const setToken = (token) => {
  accessToken = token || '';
  if (token) localStorage.setItem('accessToken', token);
  else localStorage.removeItem('accessToken');
};

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Auto-refresh on 401 (single flight).
let refreshing = null;
api.interceptors.response.use(
  (res) => res.data,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        refreshing = refreshing || api.post('/auth/refresh').then((r) => r.accessToken);
        const token = await refreshing;
        setToken(token);
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        setToken('');
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        refreshing = null;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
