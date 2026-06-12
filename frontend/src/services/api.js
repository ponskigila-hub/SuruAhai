import axios from 'axios';

const API_URL =
  process.env.REACT_APP_BACKEND_URL ??
  (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:8001');

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Services
export const getServices = () => api.get('/api/services');
export const getService = (id) => api.get(`/api/services/${id}`);
export const getCategories = () => api.get('/api/services/categories/list');
export const createService = (data) => api.post('/api/services', data);

// Mitra
export const getMitraList = (params) => api.get('/api/mitra/list', { params });
export const getMitra = (id) => api.get(`/api/mitra/${id}`);
export const updateMitraProfile = (data) => api.put('/api/mitra/profile', data);
export const toggleMitraOnline = () => api.put('/api/mitra/toggle-online');
export const getMitraDashboard = () => api.get('/api/mitra/dashboard');
export const requestMitraWithdraw = (data) => api.post('/api/wallet/withdraw', data);

// Orders
export const createOrder = (data) => api.post('/api/orders', data);
export const getOrders = () => api.get('/api/orders');
export const getOrder = (id) => api.get(`/api/orders/${id}`);
export const updateOrderStatus = (id, status) => api.put(`/api/orders/${id}/status?status=${status}`);
export const getOrderMessages = (id) => api.get(`/api/orders/${id}/messages`);
export const sendOrderMessage = (id, data) => api.post(`/api/orders/${id}/messages`, data);
export const payOrder = (id) => api.post(`/api/orders/${id}/pay`);

// Marketplace: choose mitra for an open order
export const getOrderMitras = (id, params) => api.get(`/api/orders/${id}/mitras`, { params });
export const selectMitra = (id, mitraId) => api.post(`/api/orders/${id}/select-mitra`, { mitra_id: mitraId });

// Negotiation offers (two-way)
export const getOrderOffers = (id) => api.get(`/api/orders/${id}/offers`);
export const createOffer = (id, data) => api.post(`/api/orders/${id}/offers`, data);
export const acceptOffer = (offerId) => api.post(`/api/offers/${offerId}/accept`);
export const rejectOffer = (offerId) => api.post(`/api/offers/${offerId}/reject`);

// Reviews / ratings
export const createReview = (data) => api.post('/api/reviews', data);
export const getMitraReviews = (mitraId) => api.get(`/api/reviews/mitra/${mitraId}`);
export const rateMitra = (data) => api.post('/api/ratings/mitra', data);
export const getMitraRatings = (mitraId) => api.get(`/api/ratings/mitra/${mitraId}`);
export const rateUser = (data) => api.post('/api/ratings/user', data);
export const getUserRating = (userId) => api.get(`/api/users/${userId}/rating`);

// User
export const updateProfile = (data) => api.put('/api/user/profile', data);
export const getWallet = () => api.get('/api/wallet');
export const walletTopUp = (data) => api.post('/api/wallet/topup', data);
export const getNotifications = () => api.get('/api/notifications');
export const markNotificationRead = (id) => api.post(`/api/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.post('/api/notifications/read-all');

// Geocoding (OpenStreetMap Nominatim, no API key required)
export const geocodeAddress = (query) =>
  axios.get('https://nominatim.openstreetmap.org/search', {
    params: { q: query, format: 'json', limit: 1, addressdetails: 1 },
  });
export const reverseGeocode = (lat, lng) =>
  axios.get('https://nominatim.openstreetmap.org/reverse', {
    params: { lat, lon: lng, format: 'json' },
  });

// Realtime order channel
export const buildOrderWsUrl = (orderId) => {
  const token = localStorage.getItem('token');
  const base = API_URL || window.location.origin;
  const wsBase = base.replace(/^http/, 'ws');
  return `${wsBase}/api/ws/orders/${orderId}?token=${encodeURIComponent(token || '')}`;
};

// Admin
export const getAdminDashboard = () => api.get('/api/admin/dashboard');
export const getAllUsers = () => api.get('/api/admin/users');
export const updateUserStatus = (id, isActive) => api.put(`/api/admin/users/${id}/status?is_active=${isActive}`);
export const verifyMitra = (id) => api.put(`/api/admin/mitra/${id}/verify`);
export const getEscrowList = () => api.get('/api/admin/escrow');

// Seed
export const seedData = () => api.post('/api/seed');

export default api;
