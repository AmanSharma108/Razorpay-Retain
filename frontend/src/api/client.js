import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Response interceptor for centralized error logging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with an error status code
      console.warn(`[API Error ${error.response.status}]`, error.response.data);
    } else if (error.request) {
      // Request made but no response received (network offline or timeout)
      console.error('[API Network Error] No response received from backend server:', error.message);
    }
    return Promise.reject(error);
  }
);

export const healthAPI = {
  check: () => axios.get(`${import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace(/\/api$/, '') : ''}/health`),
};

export const dashboardAPI = {
  getSummary: () => api.get('/dashboard/summary'),
  getAnalytics: () => api.get('/dashboard/analytics'),
};

export const eventsAPI = {
  list: (params) => api.get('/events', { params }),
  get: (id) => api.get(`/events/${id}`),
};

export const reviewAPI = {
  getQueue: () => api.get('/review-queue'),
  getCount: () => api.get('/review-queue/count'),
  approve: (id, data = {}) => api.post(`/review/${id}/approve`, data),
  reject: (id, data) => api.post(`/review/${id}/reject`, data),
};

export const recoveryAPI = {
  listActions: (params) => api.get('/recovery/actions', { params }),
  retryAction: (eventId) => api.post(`/recovery/actions/${eventId}/retry`),
  getPolicyStats: () => api.get('/recovery/policy-stats'),
};

export const auditAPI = {
  list: (params) => api.get('/audit/trail', { params }),
};

export const pollingAPI = {
  getStatus: () => api.get('/polling/status'),
  setInterval: (data) => api.post('/polling/interval', data),
  triggerPoll: () => api.post('/polling/trigger'),
};

export const checkoutAPI = {
  getConfig: () => api.get('/checkout/config'),
  createOrder: (data) => api.post('/checkout/create-order', data),
  createPaymentLink: (data) => api.post('/checkout/create-payment-link', data),
  createInvoice: (data) => api.post('/checkout/create-invoice', data),
  notifyFailure: (data) => api.post('/checkout/notify-failure', data),
  syncNow: () => api.post('/checkout/sync-now'),
};

export default api;

