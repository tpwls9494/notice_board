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
      let errorMessage = '로그인에 실패했습니다';

      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.status === 401) {
        errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다';
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.detail || '입력 정보를 확인해주세요';
      } else if (!error.response) {
        errorMessage = '서버에 연결할 수 없습니다';
      }

      set({
        error: errorMessage,
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
      let errorMessage = '회원가입에 실패했습니다';

      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.detail || '입력 정보를 확인해주세요';
      } else if (!error.response) {
        errorMessage = '서버에 연결할 수 없습니다';
      }

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
