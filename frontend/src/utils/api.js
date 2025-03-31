import axios from 'axios';

// API base URL
const API_URL = 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Handle common errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log errors
    console.error('API Error:', error.response || error);
    
    // Handle specific status codes
    if (error.response) {
      switch (error.response.status) {
        case 401:
          // Unauthorized
          console.error('Unauthorized');
          break;
        case 404:
          // Not found
          console.error('Resource not found');
          break;
        case 500:
          // Server error
          console.error('Server error');
          break;
        default:
          // Other errors
          console.error(`Error: ${error.response.status}`);
      }
    } else {
      // Network errors or request cancelled
      console.error('Network error or request cancelled');
    }
    
    return Promise.reject(error);
  }
);

// API endpoints
export const routers = {
  getAll: () => api.get('/routers'),
  getById: (id) => api.get(`/routers/${id}`),
  create: (data) => api.post('/routers', data),
  update: (id, data) => api.put(`/routers/${id}`, data),
  delete: (id) => api.delete(`/routers/${id}`),
  testConnection: (id) => api.post(`/routers/${id}/test-connection`),
  collectMetrics: (id) => api.post(`/routers/${id}/collect-metrics`),
  getMetrics: (id, params) => api.get(`/routers/${id}/metrics`, { params }),
};

export const metrics = {
  getSummary: () => api.get('/routers/metrics/summary'),
  getLatest: () => api.get('/routers/metrics/latest'),
};

export default {
  routers,
  metrics,
}; 