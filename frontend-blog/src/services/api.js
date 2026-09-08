import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_AUTH_ORIGIN || (import.meta.env.DEV ? 'http://localhost:8000' : 'https://jionc.com');

const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
});

localStorage.removeItem('token');
api.defaults.withCredentials = true;
api.defaults.headers.common['X-Jion-CSRF'] = '1';
api.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401) window.dispatchEvent(new Event('blog-auth-check'));
  return Promise.reject(error);
});

export const blogAPI = {
  getProfile: () => api.get('/blog/profile'),
  updateAvatar: (file) => {
    const data = new FormData();
    data.append('file', file);
    return api.post('/blog/profile/avatar', data);
  },
  resetAvatar: () => api.delete('/blog/profile/avatar'),
  getActivity: (ids, signal) => api.get('/blog/activity', { params: { ids: ids.join(',') }, signal }),
  like: (id) => api.put(`/blog/${id}/like`),
  unlike: (id) => api.delete(`/blog/${id}/like`),
  getComments: (id, page = 1, signal) => api.get(`/blog/${id}/comments`, { params: { page }, signal }),
  addComment: (id, content, parentId = null) => api.post(`/blog/${id}/comments`, { content, parent_id: parentId }),
  updateComment: (id, commentId, content) => api.patch(`/blog/${id}/comments/${commentId}`, { content }),
  deleteComment: (id, commentId) => api.delete(`/blog/${id}/comments/${commentId}`),
  getPosts: (params) => api.get('/blog/', { params }),
  getPost: (slug) => api.get(`/blog/${slug}`),
  getDrafts: (params) => api.get('/blog/drafts', { params }),
  getManagedPosts: (params) => api.get('/blog/manage/posts', { params }),
  create: (data) => api.post('/blog/', data),
  update: (id, data) => api.put(`/blog/${id}`, data),
  delete: (id) => api.delete(`/blog/${id}`),
  getCategories: () => api.get('/blog/categories'),
  createCategory: (name) => api.post('/blog/categories', { name }),
  deleteCategory: (id) => api.delete(`/blog/categories/${id}`),
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/blog/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const authAPI = {
  getProviders: () => api.get('/auth/oauth/providers'),
  oauthURL: (provider, next) => {
    const url = new URL(`/api/v1/auth/oauth/${provider}/start`, API_BASE);
    url.searchParams.set('site', 'blog');
    url.searchParams.set('next', next);
    return url.toString();
  },
  getMe: () => api.get('/auth/me'),
  login: (data) => api.post('/auth/session/login', data),
  getSession: () => api.get('/auth/session'),
  logout: () => api.post('/auth/session/logout'),
};

export default api;
