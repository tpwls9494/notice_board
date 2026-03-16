import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const blogAPI = {
  getPosts: (params) => api.get('/blog/', { params }),
  getPost: (slug) => api.get(`/blog/${slug}`),
  getDrafts: (params) => api.get('/blog/drafts', { params }),
  create: (data) => api.post('/blog/', data),
  update: (id, data) => api.put(`/blog/${id}`, data),
  delete: (id) => api.delete(`/blog/${id}`),
};

export const authAPI = {
  getMe: () => api.get('/auth/me'),
  login: (data) => api.post('/auth/login', data),
};

export default api;
