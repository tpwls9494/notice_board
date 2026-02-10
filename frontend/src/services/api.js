import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
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

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// Posts API
export const postsAPI = {
  getPosts: (page = 1, pageSize = 10, search = '', categoryId = null) => {
    let url = `/posts/?page=${page}&page_size=${pageSize}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (categoryId) url += `&category_id=${categoryId}`;
    return api.get(url);
  },
  getPost: (id) => api.get(`/posts/${id}`),
  createPost: (data) => api.post('/posts/', data),
  updatePost: (id, data) => api.put(`/posts/${id}`, data),
  deletePost: (id) => api.delete(`/posts/${id}`),
};

// Comments API
export const commentsAPI = {
  getComments: (postId) => api.get(`/comments/post/${postId}`),
  createComment: (data) => api.post('/comments/', data),
  deleteComment: (id) => api.delete(`/comments/${id}`),
};

// Categories API
export const categoriesAPI = {
  getCategories: () => api.get('/categories/'),
  getCategory: (id) => api.get(`/categories/${id}`),
  createCategory: (data) => api.post('/categories/', data),
  updateCategory: (id, data) => api.put(`/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/categories/${id}`),
};

// Likes API
export const likesAPI = {
  likePost: (postId) => api.post(`/likes/posts/${postId}/like`),
  unlikePost: (postId) => api.delete(`/likes/posts/${postId}/like`),
  getLikesCount: (postId) => api.get(`/likes/posts/${postId}/likes/count`),
};

// Files API
export const filesAPI = {
  uploadFile: (postId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/files/upload/${postId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getPostFiles: (postId) => api.get(`/files/post/${postId}`),
  downloadFile: (fileId) => `${API_URL}/api/v1/files/download/${fileId}`,
  deleteFile: (fileId) => api.delete(`/files/${fileId}`),
};

export default api;
