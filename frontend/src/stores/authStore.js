import { create } from 'zustand';
import { authAPI } from '../services/api';

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.login({ email, password });
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      set({ token: access_token, isLoading: false });
      return true;
    } catch (error) {
      set({
        error: error.response?.data?.detail || 'Login failed',
        isLoading: false
      });
      return false;
    }
  },

  register: async (email, username, password) => {
    set({ isLoading: true, error: null });
    try {
      await authAPI.register({ email, username, password });
      set({ isLoading: false });
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      console.error('Error response:', error.response);
      const errorMessage = error.response?.data?.detail || error.message || 'Registration failed';
      set({
        error: errorMessage,
        isLoading: false
      });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  fetchUser: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await authAPI.getMe();
      set({ user: response.data });
    } catch (error) {
      localStorage.removeItem('token');
      set({ token: null, user: null });
    }
  },
}));

export default useAuthStore;
