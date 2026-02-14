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

// Community API
export const communityAPI = {
  getStats: () => api.get('/community/stats'),
  getPinnedPosts: (limit = 3) => api.get(`/community/pinned?limit=${limit}`),
  getHotPosts: (window = '24h', limit = 6, categoryId = null) => {
    let url = `/community/hot?window=${window}&limit=${limit}`;
    if (categoryId) url += `&category_id=${categoryId}`;
    return api.get(url);
  },
};

// Posts API
export const postsAPI = {
  getPosts: (page = 1, pageSize = 10, search = '', categoryId = null, sort = 'latest', window = '24h') => {
    let url = `/posts/?page=${page}&page_size=${pageSize}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (categoryId) url += `&category_id=${categoryId}`;
    if (sort && sort !== 'latest') url += `&sort=${sort}`;
    if (sort === 'hot' && window) url += `&window=${window}`;
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

// MCP Categories API
export const mcpCategoriesAPI = {
  getCategories: () => api.get('/mcp-categories/'),
  getCategory: (id) => api.get(`/mcp-categories/${id}`),
  createCategory: (data) => api.post('/mcp-categories/', data),
  updateCategory: (id, data) => api.put(`/mcp-categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/mcp-categories/${id}`),
};

// MCP Servers API
export const mcpServersAPI = {
  getServers: (page = 1, pageSize = 12, search = '', categoryId = null, isFeatured = null, sortBy = 'newest') => {
    let url = `/mcp-servers/?page=${page}&page_size=${pageSize}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (categoryId) url += `&category_id=${categoryId}`;
    if (isFeatured !== null) url += `&is_featured=${isFeatured}`;
    if (sortBy) url += `&sort_by=${sortBy}`;
    return api.get(url);
  },
  getServer: (id) => api.get(`/mcp-servers/${id}`),
  createServer: (data) => api.post('/mcp-servers/', data),
  updateServer: (id, data) => api.put(`/mcp-servers/${id}`, data),
  deleteServer: (id) => api.delete(`/mcp-servers/${id}`),
  syncGithub: (id) => api.post(`/mcp-servers/${id}/sync-github`),
  syncGithubAll: () => api.post('/mcp-servers/sync-github-all'),
  getTools: (id) => api.get(`/mcp-servers/${id}/tools`),
  createTool: (id, data) => api.post(`/mcp-servers/${id}/tools`, data),
  getGuides: (id) => api.get(`/mcp-servers/${id}/guides`),
  createGuide: (id, data) => api.post(`/mcp-servers/${id}/guides`, data),
};

// MCP Reviews API
export const mcpReviewsAPI = {
  getReviews: (serverId, page = 1, pageSize = 10) =>
    api.get(`/mcp-reviews/server/${serverId}?page=${page}&page_size=${pageSize}`),
  createReview: (data) => api.post('/mcp-reviews/', data),
  updateReview: (id, data) => api.put(`/mcp-reviews/${id}`, data),
  deleteReview: (id) => api.delete(`/mcp-reviews/${id}`),
};

// MCP Playground API
export const mcpPlaygroundAPI = {
  connect: (serverId) => api.post('/mcp-playground/connect', { server_id: serverId }),
  invoke: (serverId, toolName, args = {}) =>
    api.post('/mcp-playground/invoke', { server_id: serverId, tool_name: toolName, arguments: args }),
  getUsageHistory: (page = 1, pageSize = 20) =>
    api.get(`/mcp-playground/usage-history?page=${page}&page_size=${pageSize}`),
};

export default api;
